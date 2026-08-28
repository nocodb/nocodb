import type { ClientType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { FnHandlerKey, FnVariant } from '~/db/formulav2/fn-handler';
import type { FormulaTriage } from './triage';
import NocoCache from '~/cache/NocoCache';
import { NC_REDIS_TTL } from '~/helpers/redisHelpers';
import { CacheScope } from '~/utils/globals';

/**
 * Redis key (a HASH) holding every cached formula plan decision for one model.
 * Each (column, dialect, lowering) variant is a FIELD, so invalidation is a
 * single atomic `DEL` — the same reasoning as `singleQueryCacheKey`: there is
 * no separate index whose independent expiry could strand a variant and let a
 * stale decision outlive the schema it was measured against.
 *
 * Keyed by MODEL rather than column because that is the granularity every
 * invalidation path already resolves to (`invalidateSingleQueryCacheForModels`
 * takes model ids), and because a column's plan depends on its whole reference
 * closure — anything that changes the closure reaches this model through the
 * Lookup/Rollup that the formula reads.
 */
export function formulaPlanCacheKey(modelId: string): string {
  return `${CacheScope.FORMULA_PLAN}:${modelId}`;
}

/**
 * Field identifying one plan variant within a model's hash.
 *
 * Everything that changes what `triageFormula` would return, other than the
 * tree itself, has to be in here — the dialect and the IEEE flag pick different
 * handlers, and a pinned `fnVariant` makes a site emit a different shape and
 * therefore a different size. The tree is covered by the column id plus
 * invalidation: editing a formula updates its column, which drops this hash.
 *
 * `aliasLength`, not the alias: every plain leaf is sized as
 * `alias + column_name + 5` (`makePlainLeafSizer`), so two aliases of the same
 * length yield an identical estimate. Keying on the length keeps the root reads
 * (a constant `ROOT_ALIAS`) on one entry instead of one per generated
 * `nc_rel_*` alias, while still separating estimates that genuinely differ.
 */
export function formulaPlanCacheField(params: {
  columnId: string;
  clientType?: ClientType;
  ieee?: boolean;
  aliasLength?: number;
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}): string {
  const variants = params.fnVariants
    ? Object.keys(params.fnVariants)
        .sort()
        .map((k) => `${k}=${params.fnVariants[k]}`)
        .join(',')
    : '';
  return [
    params.columnId,
    params.clientType ?? 'unknown',
    params.ieee ? 'ieee' : 'std',
    `a${params.aliasLength ?? 0}`,
    variants,
  ].join(':');
}

/**
 * Read a cached decision. Returns null on a miss, on malformed JSON, or on any
 * cache error — the caller then triages normally, so an unreachable Redis
 * degrades to today's behaviour rather than failing the build.
 */
export async function getFormulaPlanCache(
  context: NcContext,
  params: { modelId: string; field: string },
): Promise<FormulaTriage | null> {
  try {
    const raw = await NocoCache.getHashField(
      context,
      formulaPlanCacheKey(params.modelId),
      params.field,
    );
    if (!raw) return null;
    return JSON.parse(raw) as FormulaTriage;
  } catch {
    return null;
  }
}

/**
 * Write a decision as a FIELD of the model's hash and refresh the hash TTL.
 *
 * No refresh-on-read, mirroring the single-query cache: the hot path stays a
 * single `HGET`, and a perpetually-hit plan is recomputed at most once per
 * `NC_REDIS_TTL`. Best-effort — a cache write must never fail a query.
 */
export async function setFormulaPlanCache(
  context: NcContext,
  params: { modelId: string; field: string; triage: FormulaTriage },
): Promise<void> {
  try {
    const key = formulaPlanCacheKey(params.modelId);
    await NocoCache.setHashField(
      context,
      key,
      params.field,
      JSON.stringify(params.triage),
    );
    await NocoCache.expireHash(context, key, NC_REDIS_TTL);
  } catch {
    // ignore — the decision is recomputable
  }
}

/**
 * Drop every cached decision for a model. One `DEL`, so no variant can be left
 * behind. Best-effort: a failed invalidation degrades to a stale decision,
 * which the measured post-build gate still catches, and must not fail the
 * schema change that triggered it.
 */
export async function clearFormulaPlanCache(
  context: NcContext,
  modelId: string,
): Promise<void> {
  if (!modelId) return;
  try {
    await NocoCache.del(context, formulaPlanCacheKey(modelId));
  } catch {
    // ignore
  }
}
