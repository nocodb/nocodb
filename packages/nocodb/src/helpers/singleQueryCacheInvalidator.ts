import type { LookupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Column from '~/models/Column';
import type { LinksColumn } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { invalidateSingleQueryCacheForModels } from '~/helpers/metaCacheInvalidator';

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
  // compiled SQL joins the renamed physical table directly. Used both as seed
  // embedding columns and to detect Lookups/Rollups that hop onto it.
  const relationColsTargetingModel = new Set<string>(
    await loadLinkColIdsTargetingModel(context, modelId, ncMeta),
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

  await invalidateSingleQueryCacheForModels(context, [...referencingModelIds], ncMeta);
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

  // Far side of relations whose physical FK column is oldCol — their JOIN ON
  // clause embeds the column name. (FK-rename transitive propagation is out of
  // scope; only the direct far-side model is reached.)
  const referencingModelIds = await loadFarSideModelIdsForFkColumn(
    context,
    oldCol,
    ncMeta,
  );

  // seed embedding columns with the renamed column itself
  const embeddingColumnIds = new Set<string>([oldCol.id]);

  // if it's the display value, Link columns pointing at its model surface it
  if (oldCol.pv) {
    for (const colId of await loadLinkColIdsTargetingModel(
      context,
      oldCol.fk_model_id,
      ncMeta,
    )) {
      embeddingColumnIds.add(colId);
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

  await invalidateSingleQueryCacheForModels(context, [...referencingModelIds], ncMeta);
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

  // Far side of relations whose physical FK column is oldCol — their JOIN
  // embeds the column name.
  const refTableIds = await loadFarSideModelIdsForFkColumn(
    context,
    oldCol,
    ncMeta,
  );

  // Relation columns whose compiled SQL surfaces oldCol: the relation column of
  // any Lookup/Rollup that reads it directly (one hop — no physical name
  // changed, so transitive referrers can't be stale), plus — when oldCol is the
  // display value — the Links pointing at its model.
  const relationColIds = await loadDependentRelationColIds(
    context,
    oldCol.id,
    ncMeta,
  );

  if (oldCol.pv) {
    for (const colId of await loadLinkColIdsTargetingModel(
      context,
      oldCol.fk_model_id,
      ncMeta,
    )) {
      relationColIds.add(colId);
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

  await invalidateSingleQueryCacheForModels(context, [...refTableIds], ncMeta);
}

/**
 * Relation/Link column ids whose *target* (related) model is `modelId`. Their
 * compiled SQL joins `modelId`'s physical table directly, so they embed it —
 * used both as the table-rename seed and, in the column-rename `pv` case, as the
 * Links that surface the renamed display value.
 */
async function loadLinkColIdsTargetingModel(
  context: NcContext,
  modelId: string,
  ncMeta = Noco.ncMeta,
): Promise<string[]> {
  const relations = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    {
      xcCondition: {
        _and: [{ fk_related_model_id: { eq: modelId } }],
      },
    },
  );

  return relations.map((rel) => rel.fk_column_id).filter(Boolean);
}

/**
 * Far-side model ids of every relation whose physical FK column is `column` —
 * their JOIN ON clause embeds the column name. The column's own model is
 * excluded by the query. (FK-rename transitive propagation is out of scope;
 * only the direct far-side model is reached.)
 */
async function loadFarSideModelIdsForFkColumn(
  context: NcContext,
  column: Column,
  ncMeta = Noco.ncMeta,
): Promise<Set<string>> {
  const relations = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    {
      xcCondition: {
        _and: [
          {
            _or: [
              { fk_child_column_id: { eq: column.id } },
              { fk_parent_column_id: { eq: column.id } },
              { fk_mm_child_column_id: { eq: column.id } },
              { fk_mm_parent_column_id: { eq: column.id } },
            ],
          },
          { fk_related_model_id: { neq: column.fk_model_id } },
        ],
      },
    },
  );

  const modelIds = new Set<string>();
  for (const rel of relations) {
    const farSideModelId = (rel as LinksColumn).fk_related_model_id;
    if (farSideModelId) modelIds.add(farSideModelId);
  }
  return modelIds;
}

/**
 * One-hop scan: the relation column ids of every Lookup/Rollup that looks up or
 * rolls up `columnId` directly. Used by the cheap non-rename path — transitive
 * chains are handled by `expandEmbeddingColumns` instead.
 */
async function loadDependentRelationColIds(
  context: NcContext,
  columnId: string,
  ncMeta = Noco.ncMeta,
): Promise<Set<string>> {
  const relationColIds = new Set<string>();

  const targets = [
    [MetaTable.COL_LOOKUP, 'fk_lookup_column_id'],
    [MetaTable.COL_ROLLUP, 'fk_rollup_column_id'],
  ] as const;

  for (const [table, field] of targets) {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      table,
      {
        xcCondition: {
          _and: [{ [field]: { eq: columnId } }],
        },
      },
    );

    for (const row of rows) {
      relationColIds.add((row as LookupType).fk_relation_column_id);
    }
  }

  return relationColIds;
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
