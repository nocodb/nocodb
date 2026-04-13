import { isLinksOrLTAR, isMMOrMMLike, RelationTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import Base from '~/models/Base';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';

export interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

/**
 * Find all reverse link columns in OTHER tables that reference the given table,
 * soft-delete each, and create a placeholder SingleLineText column.
 *
 * Works for both V1 (Links/LTAR: mm, oo, hm, bt) and V2 (LinkToAnotherRecord: mm, oo, mo, om).
 * The query is the same: `fk_related_model_id = tableId` catches all link types.
 */
export async function cascadeLinksOnTrash(
  context: NcContext,
  tableId: string,
  ncMeta: any,
): Promise<{ columns: CascadedColumn[] } | null> {
  // Find all relations that point TO this table
  const reverseRelations = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    {
      condition: {
        fk_related_model_id: tableId,
      },
    },
  );

  if (!reverseRelations.length) return null;

  const cascaded: CascadedColumn[] = [];

  for (const rel of reverseRelations) {
    const col = await Column.get(
      context,
      { colId: rel.fk_column_id, includeDeleted: true },
      ncMeta,
    );

    // Skip columns that belong to the trashed table itself
    if (!col || col.fk_model_id === tableId) continue;

    // Skip already deleted columns
    if (col.deleted) continue;

    // Skip if the column's table is also trashed
    const colTable = await Model.get(context, col.fk_model_id, true, ncMeta);
    if (!colTable || colTable.deleted) continue;

    // Soft-delete the reverse link column + evict from cache
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      { deleted: true },
      col.id,
    );
    await NocoCache.deepDel(
      context,
      `${CacheScope.COLUMN}:${col.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Create placeholder SingleLineText — both physical DB column + meta
    const placeholderCol = await createPlaceholderColumn(
      context,
      col,
      colTable,
      ncMeta,
    );

    // Clear query caches on the affected table (same pattern as normal column delete)
    await View.clearSingleQueryCache(
      {
        ...context,
        workspace_id: colTable.fk_workspace_id,
        base_id: colTable.base_id,
      },
      col.fk_model_id,
      null,
      ncMeta,
    );

    if (placeholderCol) {
      cascaded.push({
        id: col.id,
        placeholder_id: placeholderCol.id,
        table_id: col.fk_model_id,
      });
    }
  }

  return cascaded.length ? { columns: cascaded } : null;
}

/**
 * Reverse the link cascade: delete placeholders, restore original link columns.
 * Handles deferred restore (when linked table is still trashed).
 */
export async function restoreCascadedLinks(
  context: NcContext,
  trashEntry: BaseTrash,
  ncMeta: any,
) {
  const relatedItems = trashEntry.getRelatedItems();
  if (!relatedItems?.columns?.length) return;

  for (const item of relatedItems.columns) {
    // Check if the link column's table is still valid (not trashed)
    const colTable = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      item.table_id,
    );

    if (colTable?.deleted) {
      // Table still trashed — skip (deferred restore)
      continue;
    }

    // Delete the placeholder column — both physical DB + meta + cache
    if (item.placeholder_id) {
      await dropPlaceholderColumn(context, item, colTable, ncMeta);
    }

    // Restore the original link column
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      { deleted: false },
      item.id,
    );
    // Clear the entire column list cache for the table so Column.list() re-fetches from DB.
    // deepDel(CHILD_TO_PARENT) would only remove this column from the list, leaving
    // the rest cached — Column.list() would return stale data missing the restored column.
    await NocoCache.deepDel(
      context,
      `${CacheScope.COLUMN}:${item.table_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    // Clear query caches on the affected table (same pattern as normal column delete)
    if (colTable) {
      await View.clearSingleQueryCache(
        {
          ...context,
          workspace_id: colTable.fk_workspace_id,
          base_id: colTable.base_id,
        },
        item.table_id,
        null,
        ncMeta,
      );
    }
  }

  // Handle deferred restores from OTHER tables that were trashed earlier
  await restoreDeferredLinks(context, trashEntry.resource_id, ncMeta);
}

/**
 * When table A is restored, check if any OTHER trashed table B had
 * link columns pointing to A that were deferred. If B is now live, restore those links.
 */
async function restoreDeferredLinks(
  context: NcContext,
  restoredTableId: string,
  ncMeta: any,
) {
  const allTableTrash = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.TRASH,
    { condition: { resource_type: 'table' } },
  );

  for (const entry of allTableTrash) {
    if (!entry.related_items) continue;

    let relatedItems;
    try {
      relatedItems = JSON.parse(entry.related_items);
    } catch {
      continue;
    }

    if (!relatedItems?.columns?.length) continue;

    const deferredForThisTable = relatedItems.columns.filter(
      (c: CascadedColumn) => c.table_id === restoredTableId,
    );

    if (!deferredForThisTable.length) continue;

    // Check if the entry's own table is still trashed
    const entryModel = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      entry.resource_id,
    );

    if (entryModel?.deleted) continue;

    // Restore the deferred columns
    for (const item of deferredForThisTable) {
      if (item.placeholder_id) {
        await ncMeta.metaDelete(
          context.workspace_id,
          context.base_id,
          MetaTable.COLUMNS,
          item.placeholder_id,
        );
        await NocoCache.deepDel(
          context,
          `${CacheScope.COLUMN}:${item.placeholder_id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        item.id,
      );
    }

    // Clear the entire column list cache for the restored table
    await NocoCache.deepDel(
      context,
      `${CacheScope.COLUMN}:${restoredTableId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    // Clear query caches on the restored table
    await View.clearSingleQueryCache(context, restoredTableId, null, ncMeta);
  }
}

/**
 * For field-level trash: cascade a single link column deletion.
 * Finds the reverse column and soft-deletes it + creates placeholder.
 */
export async function cascadeLinkFieldOnTrash(
  context: NcContext,
  columnId: string,
  ncMeta: any,
): Promise<{ columns: CascadedColumn[] } | null> {
  const col = await Column.get(
    context,
    { colId: columnId, includeDeleted: true },
    ncMeta,
  );
  if (!col) return null;

  // Get this column's relation options
  const colOpt = await ncMeta.metaGet2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    { fk_column_id: columnId },
  );
  if (!colOpt) return null;

  // Get the related table and its columns to find the paired reverse column
  const relatedTableId = colOpt.fk_related_model_id;
  if (!relatedTableId) return null;

  const relatedTable = await Model.get(context, relatedTableId, true, ncMeta);
  if (!relatedTable) return null;

  const relatedCols = await relatedTable.getColumns(
    {
      ...context,
      workspace_id: relatedTable.fk_workspace_id,
      base_id: relatedTable.base_id,
    },
    ncMeta,
    undefined,
    true,
    true, // includeDeleted
  );

  // Find the paired reverse column by matching relation fields
  let reverseCol: typeof col | null = null;

  for (const c of relatedCols) {
    if (!isLinksOrLTAR(c)) continue;
    if (c.id === columnId) continue;

    const revOpt = await c.getColOptions<any>(
      {
        ...context,
        workspace_id: relatedTable.fk_workspace_id,
        base_id: relatedTable.base_id,
      },
      ncMeta,
    );
    if (!revOpt) continue;

    const isMatch = matchReverseColumn(col, colOpt, revOpt);
    if (isMatch) {
      reverseCol = c;
      break;
    }
  }

  if (!reverseCol || reverseCol.deleted) return null;

  // Soft-delete the reverse column + update cache
  await ncMeta.metaUpdate(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    { deleted: true },
    reverseCol.id,
  );
  await NocoCache.deepDel(
    context,
    `${CacheScope.COLUMN}:${reverseCol.id}`,
    CacheDelDirection.CHILD_TO_PARENT,
  );

  // Create placeholder — physical DB column + meta
  const revTable = await Model.get(
    context,
    reverseCol.fk_model_id,
    true,
    ncMeta,
  );

  const placeholder = await createPlaceholderColumn(
    context,
    reverseCol,
    revTable,
    ncMeta,
  );

  // Clear query caches on the related table (same pattern as normal column delete)
  if (revTable) {
    await View.clearSingleQueryCache(
      {
        ...context,
        workspace_id: revTable.fk_workspace_id,
        base_id: revTable.base_id,
      },
      reverseCol.fk_model_id,
      null,
      ncMeta,
    );
  }

  if (!placeholder) return null;

  return {
    columns: [
      {
        id: reverseCol.id,
        placeholder_id: placeholder.id,
        table_id: reverseCol.fk_model_id,
      },
    ],
  };
}

/**
 * Match a reverse column by comparing relation options.
 * Uses the same logic as columnDelete in columns.service.ts.
 *
 * MM-like (V1 mm, V2 all): swapped parent/child + same junction + swapped MM FK columns
 * FK-based (V1 hm/bt): flipped type + same parent/child columns
 * FK-based (V1 oo): same type + same parent/child columns
 */
function matchReverseColumn(
  originalCol: any,
  original: any,
  candidate: any,
): boolean {
  if (isMMOrMMLike({ ...originalCol, colOptions: original })) {
    // MM-like: parent/child swapped + same junction + swapped MM FK columns
    return (
      candidate.fk_parent_column_id === original.fk_child_column_id &&
      candidate.fk_child_column_id === original.fk_parent_column_id &&
      candidate.fk_mm_model_id === original.fk_mm_model_id &&
      candidate.fk_mm_parent_column_id === original.fk_mm_child_column_id &&
      candidate.fk_mm_child_column_id === original.fk_mm_parent_column_id
    );
  }

  // V1 HM/BT: type flip + same parent/child columns
  if (
    original.type === RelationTypes.HAS_MANY ||
    original.type === RelationTypes.BELONGS_TO
  ) {
    const expectedType =
      original.type === RelationTypes.HAS_MANY
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
    return (
      candidate.type === expectedType &&
      candidate.fk_parent_column_id === original.fk_parent_column_id &&
      candidate.fk_child_column_id === original.fk_child_column_id
    );
  }

  // V1 OO: same type + same parent/child columns
  if (original.type === RelationTypes.ONE_TO_ONE) {
    return (
      candidate.type === RelationTypes.ONE_TO_ONE &&
      candidate.fk_parent_column_id === original.fk_parent_column_id &&
      candidate.fk_child_column_id === original.fk_child_column_id
    );
  }

  return false;
}

/**
 * Clean up cascaded link columns on permanent delete.
 * Hard-deletes the soft-deleted reverse columns + their relations.
 * Placeholder SLTs stay (user keeps snapshot data).
 */
export async function cleanupCascadedLinksOnPermanentDelete(
  context: NcContext,
  relatedItems: { columns?: CascadedColumn[] },
) {
  if (!relatedItems?.columns?.length) return;

  for (const item of relatedItems.columns) {
    await Noco.ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_RELATIONS,
      { fk_column_id: item.id },
    );
    await Noco.ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      item.id,
    );
    // Placeholder SLT stays — user keeps snapshot data
  }
}

/**
 * Create a real placeholder SingleLineText column — both physical DB column + meta.
 * Also evicts the column list cache for the affected table.
 */
async function createPlaceholderColumn(
  context: NcContext,
  originalCol: any,
  table: Model,
  ncMeta: any,
): Promise<{ id: string } | null> {
  if (!table) return null;

  const columnName = `_nc_trash_ph_${originalCol.id}`;

  const base = await Base.getWithInfo(context, table.base_id, ncMeta);
  const source = base?.sources?.find((s) => s.id === table.source_id);

  if (!source) return null;

  // Load full table with columns (same pattern as columnAdd)
  await table.getColumns(
    { ...context, workspace_id: table.fk_workspace_id, base_id: table.base_id },
    ncMeta,
  );

  // 1. Create physical DB column via sqlMgr (same pattern as columns.service.ts columnAdd)
  try {
    const sqlMgr = await ProjectMgrv2.getSqlMgr(
      context,
      { id: source.base_id },
      ncMeta,
    );

    const tableUpdateBody = {
      ...table,
      tn: table.table_name,
      originalColumns: table.columns.map((c) => ({
        ...c,
        cn: c.column_name,
      })),
      columns: [
        ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
        {
          cn: columnName,
          column_name: columnName,
          title: originalCol.title,
          uidt: 'SingleLineText',
          dt: 'varchar',
          altered: Altered.NEW_COLUMN,
        },
      ],
    };

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
  } catch (e) {
    // If physical column creation fails, skip placeholder
    return null;
  }

  // 2. Create meta entry
  const placeholderCol = await ncMeta.metaInsert2(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    {
      fk_model_id: originalCol.fk_model_id,
      base_id: originalCol.base_id,
      source_id: originalCol.source_id,
      fk_workspace_id: context.workspace_id,
      title: originalCol.title,
      column_name: columnName,
      uidt: 'SingleLineText',
      dt: 'varchar',
      order: originalCol.order,
    },
  );

  // 3. Populate placeholder with linked record display values
  try {
    await populatePlaceholderValues(
      context,
      originalCol,
      columnName,
      table,
      source,
      ncMeta,
    );
  } catch {
    // Non-fatal: placeholder column exists but couldn't be populated with values
  }

  // 4. Evict column list cache for the affected table
  await NocoCache.deepDel(
    context,
    `${CacheScope.COLUMN}:${originalCol.fk_model_id}:list`,
    CacheDelDirection.PARENT_TO_CHILD,
  );

  return placeholderCol;
}

/**
 * Populate a placeholder column with comma-separated display values from linked records.
 * Uses a read-then-bulk-update approach for cross-DB compatibility.
 */
async function populatePlaceholderValues(
  context: NcContext,
  originalCol: any,
  placeholderColumnName: string,
  table: Model,
  source: any,
  ncMeta: any,
) {
  // Get the relation options for the original link column
  const colOpt = await ncMeta.metaGet2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    { fk_column_id: originalCol.id },
  );
  if (!colOpt) return;

  // Get the related table and its primary value column
  const relatedTable = await Model.get(
    context,
    colOpt.fk_related_model_id,
    true,
    ncMeta,
  );
  if (!relatedTable) return;

  await relatedTable.getColumns(
    {
      ...context,
      workspace_id: relatedTable.fk_workspace_id,
      base_id: relatedTable.base_id,
    },
    ncMeta,
    undefined,
    true,
    true,
  );

  const pvCol = relatedTable.columns?.find((c) => c.pv);
  if (!pvCol) return;

  // Get a BaseModelSQL instance for proper schema-prefixed table paths
  const NcConnectionMgrv2 = (await import('~/utils/common/NcConnectionMgrv2'))
    .default;
  const dbDriver = await NcConnectionMgrv2.get(source);
  if (!dbDriver) return;

  // Get schema prefix from source config (PG uses schema.table_name)
  const schema = (source.getConfig?.()?.schema ||
    source.getConfig?.()?.searchPath?.[0]) as string | undefined;
  const tn = (name: string) => (schema ? `${schema}.${name}` : name);

  const sourceTableName = tn(table.table_name);
  const relatedTableName = tn(relatedTable.table_name);
  const pvColumnName = pvCol.column_name;

  // Build the subquery based on link type
  const isMMLike = isMMOrMMLike({ ...originalCol, colOptions: colOpt });

  // Fetch linked display values, grouped by source row
  let linkedRows: { source_pk: any; display_value: string }[] = [];

  if (isMMLike && colOpt.fk_mm_model_id) {
    // MM-like: join via junction table
    const junctionTable = await Model.get(
      context,
      colOpt.fk_mm_model_id,
      true,
      ncMeta,
    );
    if (!junctionTable) return;

    const mmChildCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_mm_child_column_id,
    );
    const mmParentCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_mm_parent_column_id,
    );
    const childCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_child_column_id,
    );
    const parentCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_parent_column_id,
    );

    if (!mmChildCol || !mmParentCol || !childCol || !parentCol) return;

    const junctionTn = tn(junctionTable.table_name);

    linkedRows = await dbDriver(junctionTn)
      .select(`${junctionTn}.${mmChildCol.column_name} as source_pk`)
      .select(`${relatedTableName}.${pvColumnName} as display_value`)
      .leftJoin(
        relatedTableName,
        `${junctionTn}.${mmParentCol.column_name}`,
        `${relatedTableName}.${parentCol.column_name}`,
      )
      .whereNotNull(`${relatedTableName}.${pvColumnName}`);
  } else if (colOpt.type === 'hm') {
    // HM: related table has FK pointing to source
    const childCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_child_column_id,
    );
    const parentCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_parent_column_id,
    );
    if (!childCol || !parentCol) return;

    linkedRows = await dbDriver(relatedTableName)
      .select(`${relatedTableName}.${childCol.column_name} as source_pk`)
      .select(`${relatedTableName}.${pvColumnName} as display_value`)
      .whereNotNull(`${relatedTableName}.${childCol.column_name}`);
  } else if (colOpt.type === 'bt' || colOpt.type === 'oo') {
    // BT/OO: source table has FK → single related PV per row
    const childCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_child_column_id,
    );
    const parentCol = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      colOpt.fk_parent_column_id,
    );
    if (!childCol || !parentCol) return;

    // For BT/OO, read from source table (which has the FK)
    const rows = await dbDriver(sourceTableName)
      .select(`${sourceTableName}.${childCol.column_name} as fk_val`)
      .whereNotNull(`${sourceTableName}.${childCol.column_name}`);

    if (!rows.length) return;

    // Get the related PV values for each FK
    const fkValues = rows.map((r: any) => r.fk_val);
    const relatedRows = await dbDriver(relatedTableName)
      .select(`${relatedTableName}.${parentCol.column_name} as pk_val`)
      .select(`${relatedTableName}.${pvColumnName} as display_value`)
      .whereIn(`${relatedTableName}.${parentCol.column_name}`, fkValues);

    const pvMap: Record<string, string> = {};
    for (const r of relatedRows) {
      pvMap[String(r.pk_val)] = String(r.display_value ?? '');
    }

    // Bulk update source rows with the related PV
    for (const row of rows) {
      const dv = pvMap[String(row.fk_val)];
      if (dv !== undefined) {
        await dbDriver(sourceTableName)
          .where(childCol.column_name, row.fk_val)
          .update({ [placeholderColumnName]: dv });
      }
    }
    return;
  } else {
    return;
  }

  if (!linkedRows.length) return;

  // Group display values by source PK
  const grouped: Record<string, string[]> = {};
  for (const row of linkedRows) {
    const pk = String(row.source_pk);
    if (!grouped[pk]) grouped[pk] = [];
    if (row.display_value != null) {
      grouped[pk].push(String(row.display_value));
    }
  }

  // Get the source table's PK column (the one matching fk_child_column_id)
  const childCol = await ncMeta.metaGet2(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    colOpt.fk_child_column_id,
  );
  if (!childCol) return;

  // Bulk update each source row with the comma-separated display values
  for (const [pk, values] of Object.entries(grouped)) {
    await dbDriver(sourceTableName)
      .where(childCol.column_name, pk)
      .update({ [placeholderColumnName]: values.join(', ') });
  }
}

/**
 * Drop a placeholder column — physical DB column + meta + cache.
 */
async function dropPlaceholderColumn(
  context: NcContext,
  item: CascadedColumn,
  table: any,
  ncMeta: any,
) {
  // Get the placeholder meta to know the column_name
  const phMeta = await ncMeta.metaGet2(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    item.placeholder_id,
  );

  if (phMeta && table) {
    // Drop physical DB column
    try {
      const base = await Base.getWithInfo(context, table.base_id, ncMeta);
      const source = base?.sources?.find((s) => s.id === table.source_id);

      if (source) {
        const tableModel = await Model.get(
          context,
          item.table_id,
          true,
          ncMeta,
        );
        if (tableModel) {
          await tableModel.getColumns(
            {
              ...context,
              workspace_id: tableModel.fk_workspace_id,
              base_id: tableModel.base_id,
            },
            ncMeta,
            undefined,
            true,
            true,
          );

          const sqlMgr = await ProjectMgrv2.getSqlMgr(
            context,
            { id: source.base_id },
            ncMeta,
          );

          const tableUpdateBody = {
            ...tableModel,
            tn: tableModel.table_name,
            originalColumns: tableModel.columns.map((c) => ({
              ...c,
              cn: c.column_name,
            })),
            columns: tableModel.columns.map((c) => {
              if (
                c.id === item.placeholder_id ||
                c.column_name === phMeta.column_name
              ) {
                return {
                  ...c,
                  cn: c.column_name,
                  cno: c.column_name,
                  altered: Altered.DELETE_COLUMN,
                };
              }
              return { ...c, cn: c.column_name };
            }),
          };

          await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
        }
      }
    } catch (e) {
      // Physical column drop failed — log but continue with meta cleanup
    }
  }

  // Delete meta
  await ncMeta.metaDelete(
    context.workspace_id,
    context.base_id,
    MetaTable.COLUMNS,
    item.placeholder_id,
  );

  // Evict cache
  await NocoCache.deepDel(
    context,
    `${CacheScope.COLUMN}:${item.placeholder_id}`,
    CacheDelDirection.CHILD_TO_PARENT,
  );
}
