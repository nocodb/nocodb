import * as dns from 'dns';
import * as net from 'net';
import ipaddr from 'ipaddr.js';

/**
 * SSRF protection for outbound database connections.
 *
 * Validates the resolved IP of an external DB host AT CONNECT TIME, inside the
 * driver's socket setup, rather than only at save time. This closes the TOCTOU
 * window where a short-TTL DNS record could pass a pre-flight check and then
 * flip to a private/internal address before the driver actually connects.
 *
 * Wired in via knex's per-driver `connection.stream` factory (pg + mysql/mysql2)
 * — see {@link applyDbSsrfProtection}. The factory never rewrites `host`, so the
 * driver's TLS servername / certificate verification is unaffected.
 *
 * NOTE: keep this file free of app-internal imports — it is copied verbatim into
 * packages/nc-sql-executor (a separate deployable that cannot import from
 * nocodb). Any change here must be mirrored there.
 */

// ipaddr.js range() values treated as non-routable / internal.
const BLOCKED_RANGES = new Set<string>([
  'private',
  'loopback',
  'linkLocal', // incl. 169.254.0.0/16 cloud-metadata
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

/** True if a string IP resolves into a blocked (internal / non-routable) range. */
export function isBlockedIp(addr: string): boolean {
  if (!ipaddr.isValid(addr)) return false; // unparseable → let the driver surface it
  let parsed = ipaddr.parse(addr);

  // Normalise IPv6 forms that embed an IPv4 so the IPv4 blocklist below catches
  // an internal target wrapped in an IPv6 transition encoding (CWE-918).
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      parsed = v6.toIPv4Address(); // ::ffff:a.b.c.d
    } else if (v6.range() === '6to4') {
      // 2002:WWXX:YYZZ::/16 — embedded IPv4 in bytes 2..5 (RFC 3056).
      const b = v6.toByteArray();
      parsed = new ipaddr.IPv4([b[2], b[3], b[4], b[5]]);
    } else if (v6.range() === 'rfc6052') {
      // NAT64 well-known prefix 64:ff9b::/96 — embedded IPv4 in bytes 12..15.
      const b = v6.toByteArray();
      parsed = new ipaddr.IPv4([b[12], b[13], b[14], b[15]]);
    }
  }

  return BLOCKED_RANGES.has(parsed.range());
}

function blockedError(): NodeJS.ErrnoException {
  return Object.assign(
    new Error('Connection to internal hosts is not allowed'),
    {
      code: 'EACCES',
    },
  );
}

/**
 * Drop-in replacement for dns.lookup that rejects any resolution landing in a
 * blocked range. Handles Happy-Eyeballs (`options.all === true` → array) and the
 * single-address form. Fails closed: if ANY returned address is blocked, the
 * whole lookup errors.
 */
export const validatingLookup: net.LookupFunction = (
  hostname,
  options,
  callback,
) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);

    const records: dns.LookupAddress[] = Array.isArray(address)
      ? address
      : [{ address, family: family ?? 0 }];

    for (const rec of records) {
      if (isBlockedIp(rec.address)) {
        console.warn(
          `[ssrf] blocked DB connection: ${hostname} resolved to internal ${rec.address}`,
        );
        return callback(blockedError(), '', 0);
      }
    }

    callback(null, address, family);
  });
};

/** A net.Socket that fails on next tick — used to refuse blocked IP literals. */
function refusingSocket(): net.Socket {
  const socket = new net.Socket();
  process.nextTick(() => socket.destroy(blockedError()));
  return socket;
}

/**
 * pg factory: returns a FRESH socket; pg later calls `stream.connect(port, host)`
 * positionally (node_modules/pg/lib/connection.js). We override connect to route
 * through net.Socket's options form so the validating lookup can be injected.
 */
function pgStreamFactory(): () => net.Socket {
  return () => {
    const socket = new net.Socket();
    const originalConnect = socket.connect.bind(socket);

    socket.connect = ((...args: unknown[]): net.Socket => {
      const first = args[0];
      const opts: net.TcpSocketConnectOpts =
        typeof first === 'object' && first !== null
          ? { ...(first as net.TcpSocketConnectOpts) }
          : { port: first as number, host: args[1] as string };

      // IP literals skip dns.lookup entirely → validate them directly.
      if (
        typeof opts.host === 'string' &&
        net.isIP(opts.host) &&
        isBlockedIp(opts.host)
      ) {
        console.warn(
          `[ssrf] blocked DB connection: internal IP literal ${opts.host}`,
        );
        process.nextTick(() => socket.destroy(blockedError()));
        return socket;
      }

      opts.lookup = validatingLookup;
      return originalConnect(opts);
    }) as typeof socket.connect;

    return socket;
  };
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

/**
 * mysql / mysql2 factory: must return an ALREADY-CONNECTING socket — mysql2 never
 * calls `.connect()` on a supplied stream
 * (node_modules/mysql2/lib/base/connection.js).
 */
function mysql2StreamFactory(): (opts: Mysql2StreamOpts) => net.Socket {
  return (opts) => {
    const cfg = opts.config;

    // Unix domain socket — operator-configured, no DNS involved.
    if (cfg.socketPath) return net.connect(cfg.socketPath);

    if (
      typeof cfg.host === 'string' &&
      net.isIP(cfg.host) &&
      isBlockedIp(cfg.host)
    ) {
      console.warn(
        `[ssrf] blocked DB connection: internal IP literal ${cfg.host}`,
      );
      return refusingSocket();
    }

    const socket = net.connect({
      port: cfg.port ?? 3306,
      host: cfg.host,
      lookup: validatingLookup,
    });
    socket.setNoDelay(true); // replicate mysql2's own socket tuning (skipped for custom streams)
    if (cfg.enableKeepAlive) {
      socket.on('connect', () =>
        socket.setKeepAlive(true, cfg.keepAliveInitialDelay),
      );
    }
    return socket;
  };
}

/** Returns the stream factory for a knex client, or undefined if unsupported. */
function ssrfStreamFactoryFor(client: unknown): unknown {
  switch (client) {
    case 'pg':
    case 'pg-native':
    case 'cockroachdb':
      return pgStreamFactory();
    case 'mysql':
    case 'mysql2':
      return mysql2StreamFactory();
    default:
      // sqlite (no network); mssql / oracledb / snowflake / databricks
      // (different drivers).
      return undefined;
  }
}

/**
 * Inject the validating stream factory into a knex config's `connection`.
 * No-op when disabled, for string DSN connections, unsupported clients, or when
 * a stream factory is already present.
 */
export function applyDbSsrfProtection<
  T extends { client?: unknown; connection?: unknown },
>(config: T, enabled: boolean): T {
  if (!enabled || !config || typeof config !== 'object') return config;

  const connection = config.connection;
  if (!connection || typeof connection !== 'object') return config; // string DSN — see caveat

  const conn = connection as { stream?: unknown };
  if (conn.stream) return config; // respect an explicitly supplied factory

  const stream = ssrfStreamFactoryFor(config.client);
  if (stream) conn.stream = stream;

  return config;
}
