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
  if (v6.range() === '6to4') {
    // 2002:WWXX:YYZZ::/16 — embedded IPv4 in bytes 2..5 (RFC 3056).
    const b = v6.toByteArray();
    return new ipaddr.IPv4([b[2], b[3], b[4], b[5]]);
  }
  if (v6.range() === 'rfc6052') {
    // NAT64 well-known prefix 64:ff9b::/96 — embedded IPv4 in bytes 12..15.
    const b = v6.toByteArray();
    return new ipaddr.IPv4([b[12], b[13], b[14], b[15]]);
  }
  return v6;
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

  const trimmed = host.trim();
  if (
    trimmed === '0.0.0.0' ||
    trimmed === '::' ||
    /^localhost$/i.test(trimmed)
  ) {
    throw new SsrfBlockedHostError();
  }

  // TOCTOU note: the driver re-resolves at connect-time; a controlled DNS
  // record with short TTL could flip between this lookup and the driver's
  // connect(). Mitigating fully requires passing the resolved IP to the
  // driver, which is per-driver wiring out of scope here.
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
    if (!ipaddr.isValid(addr)) continue;
    const parsed = normaliseEmbeddedIpv4(ipaddr.parse(addr));
    if (BLOCKED_RANGES.has(parsed.range())) {
      throw new SsrfBlockedHostError();
    }
  }
}
