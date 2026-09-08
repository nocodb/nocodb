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

/**
 * Pull the target host out of a connection config, whichever shape it arrives
 * in: `{ connection: { host } }`, a string DSN (`postgres://u:p@host/db`), a
 * `connectionString`, or a nested `{ connection: { connection: … } }`.
 *
 * Callers used to read `config.connection?.host` directly, which is `undefined`
 * for every non-object form — so a DSN reached the driver unvalidated.
 */
export function extractDbConnectionHosts(config: unknown): string[] {
  const hosts: string[] = [];

  const visit = (node: unknown, depth: number) => {
    if (!node || depth > 3) return;

    if (typeof node === 'string') {
      const host = hostFromDsn(node);
      if (host) hosts.push(host);
      return;
    }
    if (typeof node !== 'object') return;

    const n = node as Record<string, unknown>;
    if (typeof n.host === 'string') hosts.push(n.host);
    if (typeof n.connectionString === 'string')
      visit(n.connectionString, depth);
    if (n.connection) visit(n.connection, depth + 1);
  };

  visit((config as any)?.connection, 0);

  return hosts;
}

/**
 * Effective network host of a DB URL — the one the driver actually dials — or
 * undefined when it isn't parseable as one.
 *
 * `pg-connection-string` copies every query param onto the config, then fills
 * `host` from the URL ONLY when no `host`/`hostaddr` param is present (verified
 * against the vendored 2.9.0 copy). So a `?host=`/`?hostaddr=` param WINS over
 * the URL host: `postgres://public.example.com/db?host=169.254.169.254` reaches
 * the URL host through validation while pg connects to the param. `hostaddr` is
 * the literal address pg dials, so it outranks `host`. A comma-separated
 * failover list is left intact for {@link validateDbConnectionHost} to split.
 */
function hostFromDsn(dsn: string): string | undefined {
  const trimmed = dsn.trim().replace(/^jdbc:/i, '');
  if (!trimmed.includes('://')) return undefined;

  try {
    const url = new URL(trimmed);
    const paramHost =
      url.searchParams.get('hostaddr') ?? url.searchParams.get('host');
    // `hostname` (not `host`) drops the port. It keeps the IPv6 brackets for a
    // non-special protocol like `postgres:`, and `isIP('[::1]')` is 0 — a
    // bracketed literal would skip the range check and fall through to DNS.
    const hostname = paramHost ?? url.hostname;
    return hostname.replace(/^\[|\]$/g, '') || undefined;
  } catch {
    return undefined;
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
      // Let the driver surface DNS failures.
      return;
    }
  }

  for (const addr of resolvedIps) {
    if (isBlockedIp(addr)) {
      NcError.badRequest('Connection to internal hosts is not allowed');
    }
  }
}
