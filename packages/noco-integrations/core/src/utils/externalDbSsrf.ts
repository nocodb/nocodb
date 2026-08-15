import dns from 'dns/promises';
import { isIP } from 'net';
import ipaddr from 'ipaddr.js';

/**
 * SSRF guard for external database connections opened by integrations
 * (MSSQL, PostgreSQL, MySQL, …).
 *
 * Mirrors the backend's `validateDbConnectionHost` helper, but lives in
 * `@noco-integrations/core` because integration packages cannot import from
 * the nocodb backend. Rejects hosts that resolve to non-routable ranges
 * (private, loopback, link-local incl. cloud-metadata 169.254.0.0/16,
 * unique-local, reserved). Handles IPv6 transition encodings that wrap an
 * IPv4 (`::ffff:a.b.c.d`, 6to4, NAT64) and unbracketed literals like `::1`.
 *
 * Self-hosted deployments can bypass via `NC_ALLOW_LOCAL_EXTERNAL_DBS=true`
 * (or `NC_DISABLE_SSRF_PROTECTION=true`) to connect to localhost / private
 * databases. The backend calls `setExternalDbSsrfEnforcement(isCloud)` at
 * bootstrap so cloud always enforces regardless of those env vars.
 */

// Forced by the backend on cloud so env-var bypasses are ignored there.
let forceEnforce = false;

/**
 * Force SSRF enforcement on regardless of env-var bypasses. The backend calls
 * this once with `isCloud` so cloud deployments cannot opt out.
 */
export function setExternalDbSsrfEnforcement(force: boolean): void {
  forceEnforce = force;
}

function isDbSsrfProtectionEnabled(): boolean {
  // Cloud forces enforcement — env bypasses are ignored.
  if (forceEnforce) return true;

  // Global override — disables all SSRF protection for self-hosted.
  if (process.env.NC_DISABLE_SSRF_PROTECTION === 'true') return false;

  // External-DB-specific override for self-hosted deployments that
  // intentionally connect to localhost or private-network databases.
  if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS === 'true') return false;

  return true;
}

// ipaddr.js range values:
// ipv4: "unicast" | "private" | "loopback" | "linkLocal" | "multicast"
//       | "reserved" | "broadcast" | "unspecified" | "carrierGradeNat"
// ipv6: "unicast" | "loopback" | "linkLocal" | "uniqueLocal" |
//       "ipv4Mapped" | "rfc6145" | "rfc6052" | "6to4" | "teredo" |
//       "reserved" | "unspecified" | "benchmarking" | "amt"
const BLOCKED_RANGES = new Set([
  'private',
  'loopback',
  'linkLocal',
  'uniqueLocal',
  'reserved',
  'unspecified',
  'broadcast',
  'carrierGradeNat',
  // IPv6 transition prefixes with no cleanly-decodable embedded IPv4 here —
  // never a legitimate external DB host, so block the prefix wholesale.
  'teredo', // RFC 4380, 2001::/32
  'rfc6145', // ::ffff:0:0:0/96 (stateless IP/ICMP translation)
]);

// RFC 8215 local-use NAT64. ipaddr.js reports it as plain `unicast`, and RFC 6052
// puts the embedded IPv4 at a different offset for every prefix length ≥ /48, so
// block the /48 outright rather than guessing which one is in use.
const NAT64_LOCAL_USE = ipaddr.parseCIDR('64:ff9b:1::/48') as [
  ipaddr.IPv6,
  number,
];

/**
 * Collapse IPv6 forms embedding an IPv4 so the blocklist catches an internal
 * target wrapped in a transition encoding. Mirror of `isBlockedIp` in nocodb's
 * `helpers/dbSsrfLookup.ts` — keep the two in sync.
 */
function normaliseEmbeddedIpv4(parsed: ipaddr.IPv4 | ipaddr.IPv6) {
  if (parsed.kind() !== 'ipv6') return parsed;

  const v6 = parsed as ipaddr.IPv6;
  if (v6.isIPv4MappedAddress()) {
    return v6.toIPv4Address(); // ::ffff:a.b.c.d
  }
  const b = v6.toByteArray();
  if (v6.range() === '6to4') {
    // 2002:WWXX:YYZZ::/16 — embedded IPv4 in bytes 2..5 (RFC 3056).
    return new ipaddr.IPv4([b[2], b[3], b[4], b[5]]);
  }
  if (v6.range() === 'rfc6052') {
    // NAT64 well-known prefix 64:ff9b::/96 — embedded IPv4 in bytes 12..15.
    return new ipaddr.IPv4([b[12], b[13], b[14], b[15]]);
  }
  // RFC 4291 IPv4-compatible ::a.b.c.d. ipaddr.js only reports `ipv4Mapped` for
  // the spellings it rewrites to ::ffff:; `0::127.0.0.1` stays `unicast`.
  if (b.slice(0, 12).every((byte) => byte === 0)) {
    return new ipaddr.IPv4([b[12], b[13], b[14], b[15]]);
  }
  return v6;
}

function isBlockedIp(parsed: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  if (BLOCKED_RANGES.has(parsed.range())) return true;
  if (
    parsed.kind() === 'ipv6' &&
    (parsed as ipaddr.IPv6).match(NAT64_LOCAL_USE)
  )
    return true;
  return BLOCKED_RANGES.has(normaliseEmbeddedIpv4(parsed).range());
}

export class SsrfBlockedHostError extends Error {
  constructor(message = 'Connection to internal hosts is not allowed') {
    super(message);
    this.name = 'SsrfBlockedHostError';
  }
}

/**
 * Throws `SsrfBlockedHostError` if `host` resolves to a non-routable range.
 * No-op when SSRF protection is disabled (see `isDbSsrfProtectionEnabled`).
 */
export async function assertExternalDbHostAllowed(
  host: unknown,
): Promise<void> {
  if (!isDbSsrfProtectionEnabled()) return;
  if (typeof host !== 'string' || host.length === 0) return;

  // `new URL(...).hostname` brackets IPv6 (`[::1]`), which `isIP` cannot parse
  // - unstripped it falls through the DNS-failure branch and bypasses the
  // check.
  const trimmed = host.trim().replace(/^\[(.+)\]$/, '$1');
  if (
    trimmed === '0.0.0.0' ||
    trimmed === '::' ||
    /^localhost$/i.test(trimmed)
  ) {
    throw new SsrfBlockedHostError();
  }

  // TOCTOU: the driver re-resolves at connect time, so a short-TTL record can
  // flip between this lookup and connect().
  let resolvedIps: string[] = [];
  if (isIP(trimmed)) {
    resolvedIps = [trimmed];
  } else {
    try {
      const records = await dns.lookup(trimmed, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch {
      // Let the driver surface DNS failures.
      return;
    }
  }

  for (const addr of resolvedIps) {
    if (!ipaddr.isValid(addr)) {
      // Node accepts IPv6 spellings ipaddr.js rejects (dotted-quad tails behind a
      // multi-group prefix, on ipaddr.js < 2.2). Skipping would mean allowing, and
      // a routable host always parses — so fail closed.
      if (isIP(addr)) throw new SsrfBlockedHostError();
      continue;
    }
    if (isBlockedIp(ipaddr.parse(addr))) {
      throw new SsrfBlockedHostError();
    }
  }
}

export type ExternalUrlScheme = 'https:' | 'http:';

export interface ExternalUrlOptions {
  label: string;
  example?: string;
  schemes?: readonly ExternalUrlScheme[];
}

// Without the scheme check `file:` and `gopher:` stay reachable: the host guard
// ignores the protocol.
export async function assertExternalUrlAllowed(
  rawUrl: unknown,
  options: ExternalUrlOptions,
): Promise<URL> {
  const { label, example, schemes = ['https:'] } = options;

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error(`${label} is required`);
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(
      example
        ? `${label} is not a valid URL - use the form ${example}`
        : `${label} is not a valid URL`,
    );
  }

  if (!schemes.includes(parsed.protocol as ExternalUrlScheme)) {
    const allowed = schemes.map((s) => `${s}//`).join(' or ');
    throw new Error(`${label} must use ${allowed}`);
  }

  await assertExternalDbHostAllowed(parsed.hostname);

  return parsed;
}
