import dns from 'dns/promises';
import { isIP } from 'net';
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

  const trimmed = host.trim();
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
