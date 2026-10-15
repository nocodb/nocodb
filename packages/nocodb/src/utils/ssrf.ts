import dns from 'dns/promises';
import { isIP } from 'net';
import { OperationSource } from 'nocodb-sdk';
import {
  globalHttpAgent,
  globalHttpsAgent,
  type RequestFilteringHttpAgent,
  type RequestFilteringHttpsAgent,
} from 'request-filtering-agent';
import { isCloud } from '~/utils/constants';
import { isBlockedIp } from '~/helpers/dbSsrfLookup';

export type FilteredAgents = {
  httpAgent?: RequestFilteringHttpAgent | RequestFilteringHttpsAgent;
  httpsAgent?: RequestFilteringHttpAgent | RequestFilteringHttpsAgent;
};

/**
 * Single source of truth for whether SSRF protection is active for a given
 * outbound source. Cloud always enforces; self-hosted honors env-var bypasses.
 */
export function isSsrfProtectionEnabled({
  source,
}: {
  source?: OperationSource;
} = {}): boolean {
  // Cloud always enforces SSRF protection — env bypasses are ignored
  if (isCloud) return true;

  // Global override — disables all SSRF protection for self-hosted
  if (process.env.NC_DISABLE_SSRF_PROTECTION === 'true') return false;

  // Granular overrides per source
  if (
    source === OperationSource.HOOKS &&
    (process.env.NC_ALLOW_LOCAL_HOOKS === 'true' ||
      process.env.NC_WEBHOOK_ALLOW_PRIVATE_NETWORK === 'true')
  )
    return false;

  if (
    source === OperationSource.EXTERNAL_DBS &&
    process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS === 'true'
  )
    return false;

  if (
    source === OperationSource.DATA_IMPORT &&
    process.env.NC_ALLOW_LOCAL_DATA_IMPORT === 'true'
  )
    return false;

  if (
    source === OperationSource.VAULTS &&
    process.env.NC_ALLOW_LOCAL_VAULTS === 'true'
  )
    return false;

  return true;
}

// One agent per protocol: redirects can switch scheme (http → https).
function buildAgents(): FilteredAgents {
  return { httpAgent: globalHttpAgent, httpsAgent: globalHttpsAgent };
}

/**
 * Create-time form of the outbound check: true when the url's host is, or
 * resolves to, a blocked internal address. The agent still enforces on send.
 * Unparseable urls are not judged here.
 */
export async function isInternalUrl(
  url: string,
  source?: OperationSource,
): Promise<boolean> {
  if (!isSsrfProtectionEnabled({ source })) return false;

  let host: string;
  try {
    // `hostname` keeps the brackets around an IPv6 literal
    host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }

  if (!host) return false;
  if (isIP(host)) return isBlockedIp(host);
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  try {
    const records = await dns.lookup(host, { all: true });
    return records.some((record) => isBlockedIp(record.address));
  } catch {
    return false;
  }
}

export function getFilteredAgents({
  source,
}: {
  url: string;
  source?: OperationSource;
}): FilteredAgents {
  if (!isSsrfProtectionEnabled({ source })) return {};
  return buildAgents();
}
