import dns from 'dns/promises';
import { isIP } from 'net';
import { OperationSource } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { isSsrfProtectionEnabled } from '~/utils/ssrf';
import { isBlockedIp } from '~/helpers/dbSsrfLookup';

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
