import { lookup as dnsLookup } from 'dns';
import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import { connect as netConnect, isIP, Socket } from 'net';
import ipaddr from 'ipaddr.js';
import type { LookupAddress } from 'dns';
import type { LookupFunction, TcpSocketConnectOpts } from 'net';

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
 * Throws `SsrfBlockedHostError` if `host` is missing, a unix socket, does not
 * resolve, or resolves to a non-routable range. No-op when SSRF protection is
 * disabled (see `isDbSsrfProtectionEnabled`).
 */
export async function assertExternalDbHostAllowed(
  host: unknown,
): Promise<void> {
  if (!isDbSsrfProtectionEnabled()) return;

  // Without a host the drivers dial their local default.
  const hosts =
    typeof host === 'string'
      ? host
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean)
      : [];
  if (!hosts.length) {
    throw new SsrfBlockedHostError('Database host is required');
  }

  for (const h of hosts) await assertSingleHostAllowed(h);
}

async function assertSingleHostAllowed(host: string): Promise<void> {
  if (
    host.startsWith('/') ||
    host === '0.0.0.0' ||
    host === '::' ||
    /^localhost$/i.test(host)
  ) {
    throw new SsrfBlockedHostError();
  }

  // Fail-fast only: the address actually dialed is re-checked where the
  // integration installs `withExternalDbSsrfProtection` / `externalDbHttpAgent`.
  let resolvedIps: string[] = [];
  if (isIP(host)) {
    resolvedIps = [host];
  } else {
    try {
      const records = await dns.lookup(host, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch (err) {
      // Keep the DNS code so callers still classify it as a network failure.
      throw Object.assign(
        new SsrfBlockedHostError('Unable to resolve the database host'),
        { code: (err as NodeJS.ErrnoException)?.code },
      );
    }
  }

  for (const addr of resolvedIps) {
    if (isBlockedAddress(addr)) throw new SsrfBlockedHostError();
  }
}

function isBlockedAddress(addr: string): boolean {
  if (!ipaddr.isValid(addr)) {
    // Node accepts IPv6 spellings ipaddr.js rejects (dotted-quad tails behind a
    // multi-group prefix, on ipaddr.js < 2.2). A routable host always parses —
    // so fail closed.
    return isIP(addr) !== 0;
  }
  return isBlockedIp(ipaddr.parse(addr));
}

function blockedSocketError(): NodeJS.ErrnoException {
  return Object.assign(new SsrfBlockedHostError(), { code: 'EACCES' });
}

/** dns.lookup that fails when any resolved address is in a blocked range. */
export const externalDbValidatingLookup: LookupFunction = (
  hostname,
  options,
  callback,
) => {
  dnsLookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);

    const records: LookupAddress[] = Array.isArray(address)
      ? address
      : [{ address, family: family ?? 0 }];
    if (records.some((r) => isBlockedAddress(r.address))) {
      return callback(blockedSocketError(), '', 0);
    }
    callback(null, address, family);
  });
};

function refusingSocket(): Socket {
  const socket = new Socket();
  process.nextTick(() => socket.destroy(blockedSocketError()));
  return socket;
}

function isBlockedLiteral(host: unknown): boolean {
  return typeof host === 'string' && isIP(host) !== 0 && isBlockedAddress(host);
}

// pg calls `stream.connect(port, host)`, or `stream.connect(path)` for a socket.
function pgStream(): Socket {
  const socket = new Socket();
  const originalConnect = socket.connect.bind(socket);

  socket.connect = ((...args: unknown[]): Socket => {
    const [first, second] = args;
    if (typeof first === 'string' && first.startsWith('/')) {
      process.nextTick(() => socket.destroy(blockedSocketError()));
      return socket;
    }
    const opts: TcpSocketConnectOpts =
      typeof first === 'object' && first !== null
        ? { ...(first as TcpSocketConnectOpts) }
        : { port: Number(first), host: second as string };
    if (isBlockedLiteral(opts.host)) {
      process.nextTick(() => socket.destroy(blockedSocketError()));
      return socket;
    }
    return originalConnect({ ...opts, lookup: externalDbValidatingLookup });
  }) as typeof socket.connect;

  return socket;
}

interface Mysql2StreamOpts {
  config: {
    host?: string;
    port?: number;
    socketPath?: string;
    enableKeepAlive?: boolean;
    keepAliveInitialDelay?: number;
  };
}

// mysql2 never calls `.connect()` on a supplied stream; it must be connecting.
function mysql2Stream({ config: cfg }: Mysql2StreamOpts): Socket {
  if (cfg.socketPath || isBlockedLiteral(cfg.host)) return refusingSocket();

  const socket = netConnect({
    port: cfg.port ?? 3306,
    host: cfg.host,
    lookup: externalDbValidatingLookup,
  });
  socket.setNoDelay(true);
  if (cfg.enableKeepAlive) {
    socket.on('connect', () =>
      socket.setKeepAlive(true, cfg.keepAliveInitialDelay),
    );
  }
  return socket;
}

// tedious `options.connector`: also covers an Azure SQL redirect target.
function tediousConnector(
  opts: { host: string; port: number; localAddress?: string },
  _lookup: unknown,
  signal?: AbortSignal,
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (isBlockedLiteral(opts.host)) return reject(blockedSocketError());
    if (signal?.aborted) return reject(signal.reason);

    const socket = netConnect({
      host: opts.host,
      port: opts.port,
      localAddress: opts.localAddress,
      lookup: externalDbValidatingLookup,
    });
    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
      socket.removeListener('error', onError);
      socket.removeListener('connect', onConnect);
    };
    const onAbort = () => {
      cleanup();
      socket.destroy();
      reject(signal?.reason);
    };
    const onError = (err: Error) => {
      cleanup();
      socket.destroy();
      reject(err);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    socket.once('error', onError);
    socket.once('connect', onConnect);
  });
}

/**
 * Re-check the address the driver actually dials (pg, mysql2, mssql), so a
 * DNS answer that changes after `assertExternalDbHostAllowed` cannot reach an
 * internal host. No-op when SSRF protection is disabled.
 */
export function withExternalDbSsrfProtection<
  T extends { client?: unknown; connection?: unknown },
>(config: T): T {
  if (!isDbSsrfProtectionEnabled()) return config;

  const connection = config.connection as Record<string, any> | undefined;
  if (!connection || typeof connection !== 'object') return config;

  switch (config.client) {
    case 'pg':
    case 'postgres':
    case 'postgresql':
    case 'pg-native':
    case 'redshift':
    case 'cockroachdb':
      connection.stream = pgStream;
      break;
    case 'mysql':
    case 'mysql2':
      connection.stream = mysql2Stream;
      break;
    case 'mssql':
      connection.options = {
        ...connection.options,
        connector: tediousConnector,
      };
      break;
  }
  return config;
}

/**
 * HTTP(S) agent whose sockets resolve through the validating lookup, for
 * clients that dial over HTTP. Undefined when SSRF protection is disabled.
 */
export function externalDbHttpAgent(
  url: URL,
  tlsOptions: Pick<https.AgentOptions, 'ca'> = {},
): http.Agent | undefined {
  if (!isDbSsrfProtectionEnabled()) return undefined;

  const options = { keepAlive: true, lookup: externalDbValidatingLookup };
  return url.protocol === 'https:'
    ? new https.Agent({ ...options, ...tlsOptions })
    : new http.Agent(options);
}
