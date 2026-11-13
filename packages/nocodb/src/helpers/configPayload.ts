import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

/**
 * A connection config from a request body, as a plain object. The schema leaves
 * `config` untyped, and every check that follows (vault references, hosts,
 * SQLite) only walks objects, so a JSON string is parsed here first.
 */
export function parseConfigPayload(
  context: Pick<NcContext, 'api_version'> | undefined,
  config: unknown,
): Record<string, any> | undefined | null {
  if (config === undefined) return undefined;
  if (config === null) return null;

  let parsed = config;
  if (typeof config === 'string') {
    try {
      parsed = JSON.parse(config);
    } catch {
      parsed = undefined;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    NcError.get(context).invalidRequestBody('config must be an object');
  }

  return parsed as Record<string, any>;
}
