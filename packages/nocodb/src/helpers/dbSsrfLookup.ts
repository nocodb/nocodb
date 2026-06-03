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
]);

/** True if a string IP resolves into a blocked (internal / non-routable) range. */
export function isBlockedIp(addr: string): boolean {
  if (!ipaddr.isValid(addr)) return false; // unparseable → let the driver surface it
  let parsed = ipaddr.parse(addr);
  // Normalise IPv4-mapped IPv6 (::ffff:192.168.1.1 -> 192.168.1.1).
  if (
    parsed.kind() === 'ipv6' &&
    (parsed as ipaddr.IPv6).isIPv4MappedAddress()
  ) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address();
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
      // sqlite (no network); mssql / snowflake / databricks (different drivers).
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
