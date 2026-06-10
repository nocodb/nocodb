import type { LookupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Column from '~/models/Column';
import type { LinksColumn } from '~/models';
import View from '~/models/View';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Dedicated invalidator for the optimised single-query (read/list) cache.
 *
 * The compiled single-query SQL bakes in the *physical* table + column names of
 * every model it joins. A schema change on one model (a table rename, or an FK /
 * Lookup / Rollup / physical column rename) therefore invalidates the cached SQL
 * not just of that model but of every OTHER model whose compiled query
 * references it — directly (a Link/LTAR pointing at it) OR transitively, through
 * a multi-hop Lookup/Rollup chain (`A →lookup B →lookup/rollup C`) whose
 * innermost subquery embeds the renamed entity even though `A` has no relation
 * column pointing at it.
 *
 * `clearSingleQueryCacheForReferencingModels` (table rename) and
 * `clearSingleQueryCacheForRenamedColumnReferences` (column rename) both walk
 * that dependency graph to a fixpoint so transitive referrers are reached; the
 * older one-hop reverse-relation scans missed them.
 *
 * `clearSingleQueryCacheForColumnReferences` is the cheap one-hop variant used
 * for non-rename column updates (frequent path) — it only reaches direct
 * referrers, which is sufficient when no physical name changed.
 *
 * Single-query caching is EE-only — `View.clearSingleQueryCache` no-ops in CE.
 * The public functions short-circuit on `!Noco.isEE()` so the discovery
 * metaList2 queries don't run in CE either.
 *
 * Scope: only relation / Lookup / Rollup columns embed another model's physical
 * names in the compiled SQL, so those are the column types walked. Formula
 * columns that reference a transitive lookup are NOT traversed; extend the graph
 * if that surfaces. FK-rename transitive propagation is also out of scope (only
 * the direct far-side model is cleared).
 */

/**
 * Clear the single-query cache of every model whose compiled SQL embeds
 * `modelId`'s physical table — directly (a Link/LTAR pointing at it) or
 * transitively (a multi-hop Lookup/Rollup chain reaching it). Use after a
 * table rename.
 *
 * The renamed model's own cache is NOT cleared here; the caller clears it
 * separately (it already holds the model id).
 *
 * Discovery is a reverse transitive closure over "embedding columns" — columns
 * whose SQL references `modelId`:
 *   seed   = relation columns whose target IS `modelId` (they JOIN it), then
 *   expand = any Lookup/Rollup whose relation hops onto `modelId`, OR whose
 *            looked-up / rolled-up target column is already an embedding column.
 * Repeat until the set stops growing, then map the columns to their models.
 */
export async function clearSingleQueryCacheForReferencingModels(
  context: NcContext,
  modelId: string,
  ncMeta = Noco.ncMeta,
) {
  if (!Noco.isEE()) return;

  // Seed: relation columns whose *related* (target) model is the renamed table.
  // The relation column (`fk_column_id`) lives on the referencing model, so its
  // compiled SQL joins the renamed physical table directly.
  const relationsToModel = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    {
      xcCondition: {
        _and: [{ fk_related_model_id: { eq: modelId } }],
      },
    },
  );

  // relation columns that point AT the renamed table (used both as seed
  // embedding columns and to detect Lookups/Rollups that hop onto it)
  const relationColsTargetingModel = new Set<string>(
    relationsToModel.map((rel) => rel.fk_column_id).filter(Boolean),
  );

  // the running set of embedding column ids — columns whose SQL references the
  // renamed table, directly or transitively
  const embeddingColumnIds = new Set<string>(relationColsTargetingModel);

  const { lookups, rollups } = await loadBaseLookupsAndRollups(context, ncMeta);
  expandEmbeddingColumns(
    embeddingColumnIds,
    lookups,
    rollups,
    relationColsTargetingModel,
  );

  const referencingModelIds = await resolveModelIdsFromColumnIds(
    context,
    [...embeddingColumnIds],
    ncMeta,
  );

  // the renamed table's own cache is cleared by the caller
  referencingModelIds.delete(modelId);

  await clearModelsSingleQueryCache(context, referencingModelIds, ncMeta);
}

/**
 * Clear the single-query cache of every model whose compiled SQL embeds
 * `oldCol`'s physical column name — directly OR via a multi-hop Lookup/Rollup
 * chain. Use after a physical column RENAME. (For non-rename column updates use
 * the cheaper one-hop `clearSingleQueryCacheForColumnReferences`.)
 *
 * Embedding-column seed:
 *   - `oldCol` itself, so Lookups/Rollups OF it — and OF those — propagate;
 *   - if `oldCol` is the primary value: the Link columns pointing at its model,
 *     which surface it as the relation's display label.
 * Plus the far side of any relation whose physical FK *is* `oldCol` (its JOIN
 * embeds the column name). Then expand Lookups/Rollups to a fixpoint.
 *
 * The column's own model cache is NOT cleared here; the caller clears it.
 */
export async function clearSingleQueryCacheForRenamedColumnReferences(
  context: NcContext,
  oldCol: Column,
  ncMeta = Noco.ncMeta,
) {
  if (!Noco.isEE()) return;

  const referencingModelIds = new Set<string>();

  // Far side of relations whose physical FK column is oldCol — their JOIN ON
  // clause embeds the column name. (FK-rename transitive propagation is out of
  // scope; only the direct far-side model is reached.)
  const fkRelations = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    {
      xcCondition: {
        _and: [
          {
            _or: [
              { fk_child_column_id: { eq: oldCol.id } },
              { fk_parent_column_id: { eq: oldCol.id } },
              { fk_mm_child_column_id: { eq: oldCol.id } },
              { fk_mm_parent_column_id: { eq: oldCol.id } },
            ],
          },
          {
            fk_related_model_id: { neq: oldCol.fk_model_id },
          },
        ],
      },
    },
  );
  for (const rel of fkRelations) {
    if ((rel as LinksColumn).fk_related_model_id) {
      referencingModelIds.add((rel as LinksColumn).fk_related_model_id);
    }
  }

  // seed embedding columns with the renamed column itself
  const embeddingColumnIds = new Set<string>([oldCol.id]);

  // if it's the display value, Link columns pointing at its model surface it
  if (oldCol.pv) {
    const linksToModel = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      {
        xcCondition: {
          _and: [{ fk_related_model_id: { eq: oldCol.fk_model_id } }],
        },
      },
    );
    for (const rel of linksToModel) {
      if (rel.fk_column_id) embeddingColumnIds.add(rel.fk_column_id);
    }
  }

  const { lookups, rollups } = await loadBaseLookupsAndRollups(context, ncMeta);
  expandEmbeddingColumns(embeddingColumnIds, lookups, rollups);

  const fromColumns = await resolveModelIdsFromColumnIds(
    context,
    [...embeddingColumnIds],
    ncMeta,
  );
  for (const modelId of fromColumns) referencingModelIds.add(modelId);

  // remove self
  referencingModelIds.delete(oldCol.fk_model_id);

  await clearModelsSingleQueryCache(context, referencingModelIds, ncMeta);
}

/**
 * Clear the single-query cache of every model that references `oldCol` through
 * an FK relation, Lookup, or Rollup. Use after a non-rename column update —
 * cheap one-hop scan (no physical name changed, so transitive referrers can't
 * have stale SQL).
 *
 * The column's own model cache is NOT cleared here; the caller clears it
 * separately.
 */
export async function clearSingleQueryCacheForColumnReferences(
  context: NcContext,
  oldCol: Column,
  ncMeta = Noco.ncMeta,
) {
  if (!Noco.isEE()) return;

  const refTableIds = new Set<string>();

  // clear any related table cache if updating a FK column
  {
    // Get LTAR columns in which current column is referenced as foreign key
    const ltarColumns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      {
        xcCondition: {
          _and: [
            {
              _or: [
                { fk_child_column_id: { eq: oldCol.id } },
                { fk_parent_column_id: { eq: oldCol.id } },
                { fk_mm_child_column_id: { eq: oldCol.id } },
                { fk_mm_parent_column_id: { eq: oldCol.id } },
              ],
            },
            {
              fk_related_model_id: { neq: oldCol.fk_model_id },
            },
          ],
        },
      },
    );

    for (const linkCol of ltarColumns) {
      refTableIds.add((linkCol as LinksColumn).fk_related_model_id);
    }
  }

  const relationColIds = new Set<string>();

  // get LTAR relation columns
  {
    if (oldCol.pv) {
      // Get LTAR columns in which current column is referenced as foreign key
      const ltarColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          xcCondition: {
            _and: [
              {
                fk_related_model_id: { eq: oldCol.fk_model_id },
              },
            ],
          },
        },
      );

      for (const ltarCol of ltarColumns) {
        relationColIds.add(ltarCol.fk_column_id);
      }
    }
  }

  // get LTAR/Links relation column id of Lookup
  {
    const lkColumns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LOOKUP,
      {
        xcCondition: {
          _and: [
            {
              fk_lookup_column_id: { eq: oldCol.id },
            },
          ],
        },
      },
    );

    for (const lkCol of lkColumns) {
      relationColIds.add((lkCol as LookupType).fk_relation_column_id);
    }
  }

  // get LTAR/Links relation column id of Rollup
  {
    const rlColumns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_ROLLUP,
      {
        xcCondition: {
          _and: [
            {
              fk_rollup_column_id: { eq: oldCol.id },
            },
          ],
        },
      },
    );

    for (const rlCol of rlColumns) {
      relationColIds.add((rlCol as LookupType).fk_relation_column_id);
    }
  }

  if (relationColIds.size > 0) {
    const relationModelIds = await resolveModelIdsFromColumnIds(
      context,
      [...relationColIds],
      ncMeta,
    );
    for (const modelId of relationModelIds) {
      refTableIds.add(modelId);
    }
  }

  // remove self link
  refTableIds.delete(oldCol.fk_model_id);

  await clearModelsSingleQueryCache(context, refTableIds, ncMeta);
}

/**
 * Load every Lookup and Rollup column's metadata in the base — the edge list
 * the transitive-closure walks iterate over. Sequential (not Promise.all) since
 * `ncMeta` may be a single Knex transaction.
 */
async function loadBaseLookupsAndRollups(
  context: NcContext,
  ncMeta = Noco.ncMeta,
): Promise<{ lookups: any[]; rollups: any[] }> {
  const lookups = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_LOOKUP,
  );
  const rollups = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_ROLLUP,
  );
  return { lookups, rollups };
}

/**
 * Grow `embeddingColumnIds` (mutated in place) to a fixpoint: repeatedly add any
 * Lookup/Rollup column that surfaces an already-embedding column via its
 * looked-up / rolled-up target, OR — table-rename case — whose relation column
 * hops onto the renamed model (`relationColsTargetingModel`).
 */
function expandEmbeddingColumns(
  embeddingColumnIds: Set<string>,
  lookups: any[],
  rollups: any[],
  relationColsTargetingModel: Set<string> = new Set<string>(),
): void {
  let grew = true;
  while (grew) {
    grew = false;

    for (const lk of lookups) {
      if (embeddingColumnIds.has(lk.fk_column_id)) continue;
      if (
        relationColsTargetingModel.has(lk.fk_relation_column_id) ||
        embeddingColumnIds.has(lk.fk_lookup_column_id)
      ) {
        embeddingColumnIds.add(lk.fk_column_id);
        grew = true;
      }
    }

    for (const rl of rollups) {
      if (embeddingColumnIds.has(rl.fk_column_id)) continue;
      if (
        relationColsTargetingModel.has(rl.fk_relation_column_id) ||
        embeddingColumnIds.has(rl.fk_rollup_column_id)
      ) {
        embeddingColumnIds.add(rl.fk_column_id);
        grew = true;
      }
    }
  }
}

/**
 * Resolve a set of column ids to the set of model ids that own them.
 * Returns an empty set for empty input (skips the metaList2 query).
 */
async function resolveModelIdsFromColumnIds(
  context: NcContext,
  columnIds: string[],
  ncMeta = Noco.ncMeta,
): Promise<Set<string>> {
  const modelIds = new Set<string>();

  if (!columnIds.length) return modelIds;

  const columns = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    {
      xcCondition: {
        _and: [{ id: { in: columnIds } }],
      },
    },
  );

  for (const col of columns) {
    modelIds.add(col.fk_model_id);
  }

  return modelIds;
}

/**
 * Clear the single-query cache for each of the given model ids.
 */
async function clearModelsSingleQueryCache(
  context: NcContext,
  modelIds: Set<string>,
  ncMeta = Noco.ncMeta,
) {
  for (const modelId of modelIds) {
    await View.clearSingleQueryCache(context, modelId, null, ncMeta);
  }
}
