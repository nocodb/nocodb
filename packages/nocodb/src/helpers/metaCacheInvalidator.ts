import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import Model from '~/models/Model';
import View from '~/models/View';

/**
 * Centralised single-query (compiled-SQL) cache invalidation.
 *
 * The optimised read path caches one compiled query per (model, view) that
 * bakes in the *names* of every table it joins — links, plus rollups/lookups
 * built on links (which can chain across several models). Any schema change
 * that alters those names or relationships must invalidate not just the changed
 * model but every model whose compiled query references it.
 *
 * Doing this ad-hoc at each call site has repeatedly missed cases — table
 * rename (referencing models, incl. transitive chained lookups/rollups), link
 * trash (the link's junction system columns), link convert — leaving stale
 * `… from "<old name>"` SQL that fails with Postgres 42P01 on the next read.
 * Route all single-query invalidation through here so the logic lives in one
 * correct place.
 */
export const MetaCacheInvalidator = {
  /** Clear the single-query cache for the given model ids (deduped, nullsafe). */
  async invalidateModels(
    context: NcContext,
    modelIds: Array<string | undefined | null>,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    const ids = new Set(modelIds.filter((id): id is string => !!id));
    for (const id of ids) {
      await View.clearSingleQueryCache(context, id, null, ncMeta);
    }
  },

  /**
   * Table-level schema change (e.g. rename). Clears the changed table plus
   * every other model in its base.
   *
   * Why base-wide rather than walking only direct referencers: a model can
   * reference the renamed table *transitively* (A→B→C via chained
   * lookups/rollups), and a one-hop relation walk misses those — which is the
   * exact gap behind the recurring 42P01 on rename. Table schema changes are
   * rare and the single-query cache rebuilds lazily on the next read, so the
   * sweep is cheap and correct.
   */
  async invalidateForTableSchemaChange(
    context: NcContext,
    tableId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    if (!context.base_id) {
      return this.invalidateModels(context, [tableId], ncMeta);
    }
    const models = await Model.list(
      context,
      { base_id: context.base_id },
      ncMeta,
    );
    await this.invalidateModels(
      context,
      [tableId, ...models.map((m) => m.id)],
      ncMeta,
    );
  },

  /**
   * Link create / trash / delete. Clears the link's owning + related tables and
   * its junction model (when junction-backed) — the models whose compiled query
   * joins via this link.
   */
  async invalidateForLink(
    context: NcContext,
    colOptions: {
      fk_model_id?: string;
      fk_related_model_id?: string;
      fk_mm_model_id?: string;
    },
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    await this.invalidateModels(
      context,
      [
        colOptions.fk_model_id,
        colOptions.fk_related_model_id,
        colOptions.fk_mm_model_id,
      ],
      ncMeta,
    );
  },
};
