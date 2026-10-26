import dns from 'dns/promises';
import { isIP } from 'net';
import { URL } from 'url';
import { OperationSource } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { isSsrfProtectionEnabled } from '~/utils/ssrf';
import { isBlockedIp } from '~/helpers/dbSsrfLookup';
import { isCloud } from '~/utils';

/** SSL config keys that point at a server-side file rather than inline contents. */
const SSL_FILE_PATH_KEYS = [
  'caFilePath',
  'keyFilePath',
  'certFilePath',
] as const;

/**
 * True if the SSL config asks the server to read a certificate from a local
 * file path (vs. inline `ca`/`key`/`cert` contents).
 */
export function hasSslFilePath(ssl: unknown): boolean {
  if (!ssl || typeof ssl !== 'object') return false;
  const s = ssl as Record<string, unknown>;
  return SSL_FILE_PATH_KEYS.some((k) => !!s[k]);
}

/**
 * Reject user-supplied SSL file-path references where reading arbitrary
 * server files is an untrusted-input risk.
 *
 * Reading `ssl.{ca,key,cert}FilePath` turns the connection-test endpoint into
 * a file-existence oracle (a missing path fails differently/faster than an
 * existing one). On multi-tenant Cloud the caller is NOT the host operator, so
 * this is always blocked. Self-hosted allows it by default — the operator can
 * already read host files (accepted risk, commit a565978837) — and can opt in
 * to blocking it by setting `NC_DISABLE_DB_SSL_FILE_PATHS=true`.
 *
 * Runs before any filesystem access, so a blocked request never touches disk
 * (no timing/error signal to leak).
 */
export function validateDbConnectionSslPaths(ssl: unknown): void {
  // Cloud always enforces; env bypass is ignored (a tenant must not be able
  // to probe shared-host files).
  if (!isCloud && process.env.NC_DISABLE_DB_SSL_FILE_PATHS !== 'true') return;

  if (hasSslFilePath(ssl)) {
    NcError.badRequest(
      'SSL certificate file paths are not allowed; provide the certificate contents instead',
    );
  }
}

/** pg-connection-string reads these DSN params from disk when it builds the client. */
const DSN_SSL_FILE_PARAMS = ['sslrootcert', 'sslcert', 'sslkey'] as const;

/** Every connection-string shape knex and the drivers accept. */
function collectDsnStrings(config: unknown): string[] {
  const dsns: string[] = [];

  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 3) return;
    if (typeof node === 'string') {
      dsns.push(node);
      return;
    }
    if (typeof node !== 'object') return;

    const n = node as Record<string, unknown>;
    if (typeof n.connectionString === 'string') dsns.push(n.connectionString);
    if (typeof n.uri === 'string') dsns.push(n.uri);
    if (n.connection) visit(n.connection, depth + 1);
  };

  visit((config as any)?.connection, 0);

  return dsns;
}

function parseDsn(dsn: string): URL | undefined {
  const trimmed = dsn.trim().replace(/^jdbc:/i, '');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined;

  try {
    return new URL(trimmed);
  } catch {
    return undefined;
  }
}

/** True if a connection string names a certificate file for the driver to read. */
export function hasDsnSslFilePath(config: unknown): boolean {
  return collectDsnStrings(config).some((dsn) => {
    const url = parseDsn(dsn);
    return !!url && DSN_SSL_FILE_PARAMS.some((p) => !!url.searchParams.get(p));
  });
}

/** {@link validateDbConnectionSslPaths} for the certificate params of a DSN. */
export function validateDbConnectionDsnSslPaths(config: unknown): void {
  if (!isCloud && process.env.NC_DISABLE_DB_SSL_FILE_PATHS !== 'true') return;

  if (hasDsnSslFilePath(config)) {
    NcError.badRequest(
      'SSL certificate file paths are not allowed; provide the certificate contents instead',
    );
  }
}

interface DbConnectionTargets {
  hosts: string[];
  sockets: string[];
  invalid: boolean;
}

// Snowflake's own account/region check (snowflake-sdk `isCorrectSubdomain`).
const SNOWFLAKE_SUBDOMAIN = /^\w+([.-]\w+)*$/;

/**
 * Every network target the selected client may dial, from whatever shape the
 * config uses. Unknown clients get the generic fields, so a superset is checked.
 */
function collectDbConnectionTargets(config: unknown): DbConnectionTargets {
  const targets: DbConnectionTargets = {
    hosts: [],
    sockets: [],
    invalid: false,
  };
  const client = (config as any)?.client;

  const addHost = (value: unknown) => {
    if (typeof value !== 'string') return;
    const v = value.trim();
    if (!v) return;
    if (v.startsWith('/')) targets.sockets.push(v);
    else targets.hosts.push(v);
  };

  const addSocket = (value: unknown) => {
    if (typeof value === 'string' && value.trim())
      targets.sockets.push(value.trim());
  };

  const addUrlHost = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const url = parseDsn(value);
    if (url) addHost(url.hostname.replace(/^\[|\]$/g, ''));
    else targets.invalid = true;
  };

  // pg-connection-string copies every query param onto the config and fills
  // `host` from the URL only when no `host`/`hostaddr` param is present, so a
  // param wins; `hostaddr` is the literal address pg dials. mysql/mssql take
  // `socketPath`/`server` the same way. No host means the driver default.
  const addDsn = (dsn: string) => {
    const trimmed = dsn.trim();
    if (trimmed.startsWith('/')) return addSocket(trimmed);

    // pg-connection-string still parses what URL rejects (an empty host, no
    // scheme) and dials its `host` param, so fail closed.
    const url = parseDsn(trimmed);
    if (!url) {
      targets.invalid = true;
      return;
    }
    if (url.protocol === 'socket:') return addSocket(url.pathname || trimmed);

    const params = url.searchParams;
    let hostname = url.hostname.replace(/^\[|\]$/g, '');
    try {
      hostname = decodeURIComponent(hostname);
    } catch {
      targets.invalid = true;
    }
    addHost(
      params.get('hostaddr') ?? params.get('host') ?? (hostname || 'localhost'),
    );
    addHost(params.get('server'));
    addSocket(params.get('socketPath'));
  };

  // EZConnect (`[tcp[s]://]host[:port][/service][?https_proxy=…]`, comma lists)
  // or a connect descriptor with one `(HOST=…)` per address.
  const addOracleConnectString = (value: unknown) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const s = value.trim();

    if (s.includes('(')) {
      for (const m of s.matchAll(
        /\(\s*(?:HOST|HTTPS_PROXY)\s*=\s*([^)\s]+)\s*\)/gi,
      )) {
        addHost(m[1]);
      }
      return;
    }

    const rest = s.replace(/^[a-z]+:\/\//i, '').replace(/^\/\//, '');
    const [hostList, query] = rest.split('?', 2);
    for (const entry of hostList.split('/')[0].split(',')) {
      const e = entry.trim();
      // An unbracketed IPv6 literal carries no port.
      if (isIP(e)) {
        addHost(e);
        continue;
      }
      const m = e.match(/^\[([^\]]+)\]|^([^:]+)/);
      addHost(m?.[1] ?? m?.[2]);
    }
    if (query) addHost(new URLSearchParams(query).get('https_proxy'));
  };

  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 3) return;
    if (typeof node === 'string') return addDsn(node);
    if (typeof node !== 'object') return;

    const n = node as Record<string, any>;

    if (client === 'oracledb') {
      addOracleConnectString(n.connectString);
      addOracleConnectString(n.host);
    } else {
      addHost(n.host);
    }
    addHost(n.server);
    addHost(n.options?.server);
    addSocket(n.socketPath);
    if (typeof n.connectionString === 'string') addDsn(n.connectionString);
    if (typeof n.uri === 'string') addDsn(n.uri);

    if (client === 'snowflake') {
      // Without host/accessUrl the SDK dials `<account>.snowflakecomputing.*`.
      for (const key of ['account', 'region']) {
        if (
          n[key] != null &&
          (typeof n[key] !== 'string' || !SNOWFLAKE_SUBDOMAIN.test(n[key]))
        ) {
          targets.invalid = true;
        }
      }
      addUrlHost(n.accessUrl);
      addHost(n.proxyHost);
    }
    if (client === 'databricks') addHost(n.proxy?.host);

    if (n.connection) visit(n.connection, depth + 1);
  };

  visit((config as any)?.connection, 0);

  return targets;
}

/**
 * Pull the target hosts out of a connection config, whichever shape it arrives
 * in: `{ connection: { host } }`, a string DSN, a `connectionString`/`uri`, a
 * nested `{ connection: { connection: … } }`, and the client-specific fields
 * (mssql `server`, oracle `connectString`, snowflake/databricks hosts).
 */
export function extractDbConnectionHosts(config: unknown): string[] {
  return collectDbConnectionTargets(config).hosts;
}

// Connection fields that choose where a client connects.
const DB_TARGET_PATHS = [
  'host',
  'hostaddr',
  'port',
  'server',
  'options.server',
  'options.instanceName',
  'socketPath',
  'connectString',
  'connectionString',
  'uri',
  'account',
  'region',
  'accessUrl',
  'proxyHost',
  'proxyPort',
  'proxy.host',
  'proxy.port',
];

/** The target fields a config sets, flattened to comparable strings. */
export function dbTargetFields(config: unknown): Record<string, string> {
  const fields: Record<string, string> = {};

  const visit = (node: unknown, prefix: string, depth: number) => {
    if (node === undefined || node === null || node === '' || depth > 3) return;
    if (typeof node !== 'object') {
      fields[`${prefix}(dsn)`] = String(node);
      return;
    }

    for (const path of DB_TARGET_PATHS) {
      const value = path.split('.').reduce<any>((obj, key) => obj?.[key], node);
      if (value === undefined || value === null || value === '') continue;
      fields[prefix + path] =
        typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    visit((node as any).connection, `${prefix}connection.`, depth + 1);
  };

  visit((config as any)?.connection, '', 0);

  return fields;
}

/** True when `incoming` would connect somewhere other than `stored`. */
export function hasDbTargetChanged(
  stored: unknown,
  incoming: unknown,
): boolean {
  const client = (incoming as any)?.client ?? (stored as any)?.client;
  if (client !== (stored as any)?.client) return true;

  const before = dbTargetFields(stored);
  const after = dbTargetFields(incoming);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].some(
    (key) => before[key] !== after[key],
  );
}

/**
 * {@link validateDbConnectionTargets} for an update: an unchanged target is not
 * re-checked, so a rename or flag toggle still saves when the stored host no
 * longer passes (e.g. legacy source configs that are never dialed).
 */
export async function validateChangedDbConnectionTargets(
  incoming: unknown,
  stored: unknown,
): Promise<void> {
  if (stored && !hasDbTargetChanged(stored, incoming)) return;
  await validateDbConnectionTargets(incoming);
}

/**
 * Pre-flight for every external-DB write and connection test: reject internal
 * hosts in every field the driver dials, unix sockets, and (by policy) DSN
 * certificate files. sqlite is left to the filename guard.
 */
export async function validateDbConnectionTargets(
  config: unknown,
): Promise<void> {
  validateDbConnectionDsnSslPaths(config);

  if (!isSsrfProtectionEnabled({ source: OperationSource.EXTERNAL_DBS }))
    return;

  const client = (config as any)?.client;
  if (typeof client === 'string' && client.includes('sqlite')) return;

  const targets = collectDbConnectionTargets(config);

  if (targets.invalid) {
    NcError.badRequest('Invalid database connection configuration');
  }
  if (targets.sockets.length) {
    NcError.badRequest('Connection to internal hosts is not allowed');
  }
  for (const host of targets.hosts) {
    await validateDbConnectionHost(host);
  }
}

/**
 * Reject database hosts that resolve to non-routable ranges (private,
 * loopback, link-local incl. cloud-metadata 169.254.0.0/16, unique-local,
 * reserved). Handles IPv4-mapped IPv6 (`::ffff:a.b.c.d`) and unbracketed
 * IPv6 literals like `::1`.
 *
 * Set `NC_ALLOW_LOCAL_EXTERNAL_DBS=true` (or `NC_DISABLE_SSRF_PROTECTION=true`)
 * to trust the operator and bypass the check — used by deployments that
 * intentionally connect to localhost or private-network databases.
 */
export async function validateDbConnectionHost(host: unknown): Promise<void> {
  if (!isSsrfProtectionEnabled({ source: OperationSource.EXTERNAL_DBS }))
    return;
  if (typeof host !== 'string' || host.length === 0) return;

  // pg/mysql accept a comma-separated failover list and connect to each host in
  // turn, so validate every entry. A combined `"127.0.0.1,10.0.0.1"` is not an
  // IP and doesn't resolve, so it would otherwise fail open at the `dns.lookup`
  // catch below — letting one private target hide inside the list.
  const hostList = host
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);
  if (hostList.length === 0) return;
  if (hostList.length > 1) {
    for (const h of hostList) await validateDbConnectionHost(h);
    return;
  }

  const trimmed = hostList[0];
  if (
    trimmed.startsWith('/') ||
    trimmed === '0.0.0.0' ||
    trimmed === '::' ||
    /^localhost$/i.test(trimmed)
  ) {
    NcError.badRequest('Connection to internal hosts is not allowed');
  }

  // Save-time fail-fast for better UX. The authoritative, TOCTOU-free check runs
  // at connect-time via the validating lookup wired into the knex stream factory
  // (see dbSsrfLookup.ts + CustomKnex.ts) — that resolution is the one the driver
  // actually connects to, so a short-TTL DNS flip can't slip past it. The range
  // check itself is shared via isBlockedIp so both paths stay in sync.
  let resolvedIps: string[] = [];
  if (isIP(trimmed)) {
    resolvedIps = [trimmed];
  } else {
    try {
      const records = await dns.lookup(trimmed, { all: true });
      resolvedIps = records.map((r) => r.address);
    } catch {
      // Fail closed: clients without a connect-time hook (oracle, snowflake,
      // databricks, string DSNs) rely on this check alone, and a name that
      // resolves only later would skip it.
      NcError.badRequest('Unable to resolve the database host');
    }
  }

  for (const addr of resolvedIps) {
    if (isBlockedIp(addr)) {
      NcError.badRequest('Connection to internal hosts is not allowed');
    }
  }
}
