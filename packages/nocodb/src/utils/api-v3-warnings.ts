import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Why a key the caller sent did not take effect.
 *
 * Only `unsupported_key` is produced today, and that is the point. The other
 * two failure modes this channel was built for are now hard errors instead:
 *
 * - an *unknown* key is rejected by ajv — the v3 form schemas close with
 *   `additionalProperties: false`, so a misspelling like `label` for `alias`
 *   comes back as a 400 naming the key rather than a silent drop;
 * - *stored but never enforced* is gone for field options, because the update
 *   path validates against the stored field type instead of skipping when
 *   `type` is absent, and for form validators, because the submit path now
 *   evaluates them server-side.
 *
 * What remains is the asymmetry this cannot catch statically: a key the
 * request schema accepts that no write path has a home for.
 */
export type V3WriteWarningReason = 'unsupported_key';

export interface V3WriteWarning {
  key: string;
  reason: V3WriteWarningReason;
  detail?: string;
}

/**
 * Side channel from the v3 services to the MCP layer. It deliberately leaves
 * the v3 REST response shape alone — adding `warnings` to every write response
 * would be an API contract change across every endpoint.
 *
 * Scoped per call rather than per request: one Express `req` serves every
 * message in a JSON-RPC batch and the transport dispatches them concurrently,
 * so a sink hung off `req` would hand one call's warnings to another.
 * Outside a scope (REST, jobs) recording is a no-op.
 */
const scope = new AsyncLocalStorage<V3WriteWarning[]>();

/** Run `fn` with its own sink, and hand back whatever it recorded. */
export async function collectV3Warnings<T>(
  fn: () => Promise<T>,
): Promise<[T, V3WriteWarning[]]> {
  const sink: V3WriteWarning[] = [];
  // a throw discards the sink with the scope, so nothing survives into the
  // next call
  return scope.run(sink, async () => [await fn(), sink]);
}

export function recordV3Warnings(warnings: V3WriteWarning[]) {
  if (!warnings.length) return;
  scope.getStore()?.push(...warnings);
}

/** Convenience for the only case there is: an allowlist dropped these keys. */
export function unsupportedKeyWarnings(
  keys: string[],
  detail?: string,
): V3WriteWarning[] {
  return keys.map((key) => ({
    key,
    reason: 'unsupported_key' as const,
    detail,
  }));
}
