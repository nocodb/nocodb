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
  // Cloud always enforces SSRF protection — NC_DISABLE_SSRF_PROTECTION is ignored
  if (isCloud) return buildAgents(url);

  // Global override — disables all SSRF protection for self-hosted
  if (process.env.NC_DISABLE_SSRF_PROTECTION === 'true') return {};

  // Granular overrides (existing env vars)
  if (
    source === OperationSource.HOOKS &&
    (process.env.NC_ALLOW_LOCAL_HOOKS === 'true' ||
      process.env.NC_WEBHOOK_ALLOW_PRIVATE_NETWORK === 'true')
  )
    return {};

  if (
    source === OperationSource.EXTERNAL_DBS &&
    process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS === 'true'
  )
    return {};

  return buildAgents(url);
}
