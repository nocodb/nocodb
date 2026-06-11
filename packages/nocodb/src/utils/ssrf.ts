import { OperationSource } from 'nocodb-sdk';
import {
  type RequestFilteringHttpAgent,
  type RequestFilteringHttpsAgent,
  useAgent,
} from 'request-filtering-agent';
import { isCloud } from '~/utils/constants';

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

  return true;
}

function buildAgents(url: string): FilteredAgents {
  return { httpAgent: useAgent(url), httpsAgent: useAgent(url) };
}

export function getFilteredAgents({
  url,
  source,
}: {
  url: string;
  source?: OperationSource;
}): FilteredAgents {
  if (!isSsrfProtectionEnabled({ source })) return {};
  return buildAgents(url);
}
