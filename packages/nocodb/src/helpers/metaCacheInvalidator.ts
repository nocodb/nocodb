import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import View from '~/models/View';

/**
 * Clear the optimised single-query (read/list) cache for a set of models.
 *
 * The compiled single-query SQL bakes in the physical names of every model it
 * joins, so a structural change to one model must invalidate the cache of every
 * model whose query references it. This is the small, shared primitive — given
 * the already-resolved set of affected model ids, clear each (deduped, nullsafe,
 * no-ops in CE via `View.clearSingleQueryCache`).
 *
 * Resolving *which* models are affected for a given change lives with the change
 * (e.g. `singleQueryCacheInvalidator` for rename, the field-trash handler for a
 * trashed link's junction). Pass the context that owns each model — callers that
 * span bases must invalidate per-base.
 */
export async function invalidateSingleQueryCacheForModels(
  context: NcContext,
  modelIds: Array<string | undefined | null>,
  ncMeta: MetaService = Noco.ncMeta,
): Promise<void> {
  const ids = new Set(modelIds.filter((id): id is string => !!id));
  for (const id of ids) {
    await View.clearSingleQueryCache(context, id, null, ncMeta);
  }
}
