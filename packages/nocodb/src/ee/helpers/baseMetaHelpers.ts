import hash from 'object-hash';
import { Logger } from '@nestjs/common';
import { isVirtualCol, ModelTypes, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import Noco from '~/Noco';
import {
  BaseRelatedMetaTables,
  MetaTable,
  SoftDeleteMetaTables,
} from '~/utils/globals';
import { Base, Column, Model, Source } from '~/models';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { runWithoutCache } from '~/cache/cacheBypassScope';

const logger = new Logger('BaseMetaHelpers');

// Altered enum from columns service
enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8,
}

const isPhysicalCol = (col: Column) => {
  return (
    !isVirtualCol(col) ||
    ([
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ].includes(col.uidt) &&
      col.system)
  );
};

const isMetadataOnly = (modelType: ModelTypes) => {
  return [ModelTypes.DASHBOARD, ModelTypes.VIEW, ModelTypes.DOCUMENT].includes(
    modelType,
  );
};

// Fields excluded from hash comparison — timestamps cause spurious diffs
const hashExcludeKeys = (key: string) =>
  key === 'created_at' || key === 'updated_at' || key === 'pgSerialLastVal';

const serializableMetaTables = BaseRelatedMetaTables.filter(
  (t) =>
    ![
      MetaTable.COMMENTS,
      MetaTable.COMMENTS_REACTIONS,
      MetaTable.SOURCES,
    ].includes(t),
);

const tablePrimaryKeys: Record<string, string | string[]> = {
  [MetaTable.GRID_VIEW]: 'fk_view_id',
  [MetaTable.FORM_VIEW]: 'fk_view_id',
  [MetaTable.GALLERY_VIEW]: 'fk_view_id',
  [MetaTable.KANBAN_VIEW]: 'fk_view_id',
  [MetaTable.CALENDAR_VIEW]: 'fk_view_id',
  [MetaTable.MAP_VIEW]: 'fk_view_id',
  [MetaTable.LIST_VIEW]: 'fk_view_id',
  [MetaTable.MODEL_STAT]: ['fk_workspace_id', 'base_id', 'fk_model_id'],
  [MetaTable.DOC_CONTENT]: ['base_id', 'fk_doc_id'],
  // Default to 'id' for all other tables
};

// Helper function to get record identifier
function getRecordKey(record: any, metaTable: string): string {
  const pkFields = tablePrimaryKeys[metaTable] || 'id';

  if (Array.isArray(pkFields)) {
    // Composite key: join values with a delimiter
    return pkFields.map((field) => record[field]).join('::');
  }

  return record[pkFields];
}

const orderedSerializableMetaTables = [
  // Core structure first
  MetaTable.MODELS,
  MetaTable.COLUMNS,

  // Column properties
  MetaTable.COL_RELATIONS,
  MetaTable.COL_SELECT_OPTIONS,
  MetaTable.COL_LOOKUP,
  MetaTable.COL_ROLLUP,
  MetaTable.COL_FORMULA,
  MetaTable.COL_QRCODE,
  MetaTable.COL_BARCODE,
  MetaTable.COL_LONG_TEXT,
  MetaTable.COL_BUTTON,

  // Views and their dependencies
  MetaTable.VIEWS,
  MetaTable.GRID_VIEW,
  MetaTable.GRID_VIEW_COLUMNS,
  MetaTable.FORM_VIEW,
  MetaTable.FORM_VIEW_COLUMNS,
  MetaTable.GALLERY_VIEW,
  MetaTable.GALLERY_VIEW_COLUMNS,
  MetaTable.KANBAN_VIEW,
  MetaTable.KANBAN_VIEW_COLUMNS,
  MetaTable.CALENDAR_VIEW,
  MetaTable.CALENDAR_VIEW_COLUMNS,
  MetaTable.CALENDAR_VIEW_RANGE,
  MetaTable.MAP_VIEW,
  MetaTable.MAP_VIEW_COLUMNS,
  MetaTable.LIST_VIEW,
  MetaTable.LIST_VIEW_LEVELS,
  MetaTable.LIST_VIEW_COLUMNS,

  // Filters and sorts
  MetaTable.FILTER_EXP,
  MetaTable.SORT,

  // Hooks and extensions
  MetaTable.HOOKS,
  MetaTable.EXTENSIONS,

  // Base variables
  MetaTable.BASE_VARIABLES,

  // Permissions and visibility
  MetaTable.MODEL_ROLE_VISIBILITY,
  MetaTable.PERMISSIONS,
  MetaTable.PERMISSION_SUBJECTS,

  // UI customizations
  MetaTable.ROW_COLOR_CONDITIONS,
  MetaTable.CUSTOM_URLS,

  // Dashboards and widgets
  MetaTable.DASHBOARDS,
  MetaTable.WIDGETS,

  // Sync configurations
  MetaTable.SYNC_SOURCE,
  MetaTable.SYNC_CONFIGS,
  MetaTable.SYNC_MAPPINGS,
  MetaTable.SYNC_LOGS,

  // Document content (satellite table — metadata is in MODELS)
  MetaTable.DOC_CONTENT,

  // Scripts and workflows
  MetaTable.AUTOMATIONS,
  MetaTable.DEPENDENCY_TRACKER,

  // Statistics
  MetaTable.MODEL_STAT,
].filter((table) => serializableMetaTables.includes(table));

// Tables where `source_id` has a different meaning than data-source ID
// (e.g. dependency tracker's source_id is an entity reference, not a DB source).
// base_id and fk_workspace_id are still overridden for correct cross-base diffing.
export const skipSourceIdOverrideTables = [MetaTable.DEPENDENCY_TRACKER];

export type BaseMetaSchema = {
  [K in (typeof serializableMetaTables)[number]]?: any;
};

export type BaseMetaDiff = {
  add: BaseMetaSchema;
  delete: BaseMetaSchema;
  update: BaseMetaSchema;
};

// Documents are treated as data on sandboxes — they live alongside the schema
// but their lifecycle is independent. Strip them from any meta snapshot that
// feeds sandbox create / discard / diff so doc rows never participate in the
// sandbox↔master sync.
export function stripDocuments(meta: BaseMetaSchema): BaseMetaSchema {
  const models: any[] = meta[MetaTable.MODELS] ?? [];
  const docIds = new Set(
    models.filter((m) => m.type === ModelTypes.DOCUMENT).map((m) => m.id),
  );
  if (docIds.size === 0 && !meta[MetaTable.DOC_CONTENT]?.length) return meta;

  return {
    ...meta,
    [MetaTable.MODELS]: models.filter((m) => !docIds.has(m.id)),
    [MetaTable.DOC_CONTENT]: [],
  };
}

export async function serializeMeta(
  sourceContext: NcContext,
  options?: {
    override?: {
      base_id?: string;
      fk_workspace_id?: string;
      source_id?: string; // Override source_id for cross-base sync
    };
    prefix?: {
      old: string;
      new: string;
    };
  },
  ncMeta = Noco.ncMeta,
): Promise<BaseMetaSchema> {
  const { override, prefix } = options || {};

  const base_id = sourceContext.base_id;

  if (!base_id) {
    throw new Error('Base ID is required for serialization');
  }

  const baseSchema = {} as BaseMetaSchema;

  try {
    // Use ordered tables to ensure proper dependency resolution
    for (const metaTable of orderedSerializableMetaTables) {
      try {
        const query = ncMeta
          .knex(metaTable)
          .where('base_id', base_id)
          .orderBy('created_at', 'asc');

        if (SoftDeleteMetaTables.includes(metaTable)) {
          query.where((qb) =>
            qb.where('deleted', false).orWhereNull('deleted'),
          );
        }

        const records = await query.select();

        // Apply overrides if provided (for changing base_id/workspace_id/source_id)
        if (override && records.length > 0) {
          const skipSourceId = skipSourceIdOverrideTables.includes(metaTable);

          for (const record of records) {
            // Only override specified fields, preserve all other data
            if (override.base_id !== undefined) {
              record.base_id = override.base_id;
            }
            if (override.fk_workspace_id !== undefined) {
              record.fk_workspace_id = override.fk_workspace_id;
            }
            if (
              !skipSourceId &&
              override.source_id !== undefined &&
              record.source_id !== undefined
            ) {
              record.source_id = override.source_id;
            }
          }
        }

        // override prefix on model table_name
        if (prefix && records.length > 0) {
          if (metaTable === MetaTable.MODELS) {
            for (const record of records) {
              if (prefix.old && record.table_name.startsWith(prefix.old)) {
                record.table_name =
                  prefix.new + record.table_name.slice(prefix.old.length);
              }
            }
          }
        }

        // Extract pgSerialLastVal for PostgreSQL tables
        if (metaTable === MetaTable.MODELS && records.length > 0) {
          const base = await Base.get(sourceContext, base_id, ncMeta);
          if (base) {
            for (const record of records) {
              if (record.type === ModelTypes.TABLE) {
                const source = await Source.get(
                  sourceContext,
                  record.source_id,
                  false,
                  ncMeta,
                );
                if (source?.type === 'pg') {
                  try {
                    const model = await Model.get(
                      sourceContext,
                      record.id,
                      false,
                      ncMeta,
                    );
                    if (model) {
                      await model.getColumns(sourceContext, ncMeta);
                      const aiColumn = model.columns.find((col) => col.ai);

                      if (aiColumn) {
                        const baseModel = await Model.getBaseModelSQL(
                          sourceContext,
                          {
                            id: model.id,
                            viewId: null,
                            dbDriver: await NcConnectionMgrv2.get(source),
                          },
                        );
                        const sqlClient = await NcConnectionMgrv2.getSqlClient(
                          source,
                        );
                        const seq = await sqlClient.raw(
                          `SELECT pg_get_serial_sequence('??', ?) as seq;`,
                          [
                            baseModel.getTnPath(model.table_name),
                            aiColumn.column_name,
                          ],
                        );

                        if (seq.rows.length > 0 && seq.rows[0].seq) {
                          // seqName is a pre-formatted identifier from
                          // pg_get_serial_sequence (e.g. schema."Table_id_seq").
                          // Using ?? would double-quote it, so interpolate directly.
                          const seqName = seq.rows[0].seq;
                          const res = await sqlClient.raw(
                            `SELECT last_value as last FROM ${seqName};`,
                          );

                          if (res.rows.length > 0) {
                            record.pgSerialLastVal = res.rows[0].last;
                          }
                        }
                      }
                    }
                  } catch (error) {
                    logger.error(
                      `Failed to extract pgSerialLastVal for table ${record.table_name}: ${error.message}`,
                      error.stack,
                    );
                    // Continue without pgSerialLastVal
                  }
                }
              }
            }
          }
        }

        // remove uuid for shared to avoid conflicts
        if (records.length > 0) {
          if (metaTable === MetaTable.VIEWS) {
            for (const record of records) {
              record.uuid = null;
            }
          }
        }

        baseSchema[metaTable] = records;
      } catch (error) {
        logger.error(
          `Failed to serialize table ${metaTable}: ${error.message}`,
          error.stack,
        );
        throw new Error(
          `Failed to serialize table ${metaTable}: ${error.message}`,
        );
      }
    }

    return baseSchema;
  } catch (error) {
    logger.error(
      `Failed to serialize base metadata: ${error.message}`,
      error.stack,
    );
    throw new Error(`Failed to serialize base metadata: ${error.message}`);
  }
}

export async function diffMeta(
  oldMeta: BaseMetaSchema,
  newMeta: BaseMetaSchema,
): Promise<BaseMetaDiff> {
  const diffedMeta = {
    add: {},
    delete: {},
    update: {},
  } as BaseMetaDiff;

  try {
    // Use ordered tables for consistent processing
    for (const metaTable of orderedSerializableMetaTables) {
      const oldRecords = oldMeta[metaTable] || [];
      const newRecords = newMeta[metaTable] || [];

      const oldRecordMap = new Map(
        oldRecords.map((r) => [getRecordKey(r, metaTable), r]),
      );
      const newRecordMap = new Map(
        newRecords.map((r) => [getRecordKey(r, metaTable), r]),
      );

      const toAdd = newRecords.filter(
        (r) => !oldRecordMap.has(getRecordKey(r, metaTable)),
      );
      const toDelete = oldRecords.filter(
        (r) => !newRecordMap.has(getRecordKey(r, metaTable)),
      );
      const toUpdate = newRecords.filter((r) => {
        const key = getRecordKey(r, metaTable);
        if (!oldRecordMap.has(key)) return false;
        const oldRecord = oldRecordMap.get(key);
        try {
          return (
            hash(oldRecord, { excludeKeys: hashExcludeKeys }) !==
            hash(r, { excludeKeys: hashExcludeKeys })
          );
        } catch (error) {
          logger.warn(
            `Hash comparison failed for ${metaTable} record ${key}: ${error.message}`,
          );
          // Fallback to JSON comparison (exclude timestamps for consistency)
          const strip = (o: any) => {
            const { created_at, updated_at, ...rest } = o;
            return rest;
          };
          return JSON.stringify(strip(oldRecord)) !== JSON.stringify(strip(r));
        }
      });

      if (toAdd.length || toDelete.length || toUpdate.length) {
        diffedMeta.add[metaTable] = toAdd;
        diffedMeta.delete[metaTable] = toDelete;
        diffedMeta.update[metaTable] = toUpdate;
      }
    }

    return diffedMeta;
  } catch (error) {
    logger.error(`Failed to diff base metadata: ${error.message}`, error.stack);
    throw new Error(`Failed to diff base metadata: ${error.message}`);
  }
}

// Helper function for creating column indexes
async function createColumnIndex(
  context: NcContext,
  {
    column,
    sqlMgr,
    source,
    indexName,
    nonUnique = true,
    tableName,
  }: {
    column: Column;
    sqlMgr: SqlMgrv2;
    source: Source;
    indexName: string;
    nonUnique?: boolean;
    tableName: string;
  },
) {
  const indexArgs = {
    columns: [column.column_name],
    tn: tableName,
    non_unique: nonUnique,
    indexName,
  };
  await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
}

// Helper function to set PostgreSQL sequence value for auto-increment columns
async function setPostgresSequenceValue(
  context: NcContext,
  {
    table,
    columns,
    source,
    pgSerialLastVal,
  }: {
    table: Model;
    columns: Column[];
    source: Source;
    pgSerialLastVal?: number;
  },
) {
  if (source.type !== 'pg' || !pgSerialLastVal) {
    return;
  }

  // Find the auto-increment column
  const aiColumn = columns.find((col) => col.ai);
  if (!aiColumn) {
    return;
  }

  try {
    const baseModel = await Model.getBaseModelSQL(context, {
      id: table.id,
      viewId: null,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    await sqlClient.raw(`SELECT setval(pg_get_serial_sequence('??', ?), ?);`, [
      baseModel.getTnPath(table.table_name),
      aiColumn.column_name,
      pgSerialLastVal,
    ]);
  } catch (error) {
    logger.error(
      `Failed to set PostgreSQL sequence value for table ${table.table_name}: ${error.message}`,
      error.stack,
    );
    // Don't throw - this is not critical enough to fail the entire operation
  }
}

/**
 * Callers MUST do both of the following AFTER this function returns:
 *   1. Commit the transaction (`trx.commit()`)
 *   2. Clear cache (`await NocoCache.clear(targetContext)`)
 *
 * Cache clearing inside the transaction causes a race: concurrent requests
 * see a cache miss, query the pre-commit DB, and repopulate with stale data.
 */
export async function applyMeta(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  ncMeta = Noco.ncMeta,
  options: {
    progressCallback?: (step: string, progress: number) => void;
  } = {},
): Promise<void> {
  // Bypass NocoCache within the entire transaction: reads inside a trx would
  // return stale pre-commit state (e.g. a cMASTER column inserted in Step 4
  // being masked by a cached cSANDBOX row deleted in Step 2), and writes would
  // leak transaction-local data into the shared cache. See cacheBypassScope.ts.
  return runWithoutCache(async () => {
    const base_id = targetContext.base_id;

    if (!base_id) {
      throw new Error('Target base ID is required');
    }

    const base = await Base.get(targetContext, base_id, ncMeta);
    if (!base) {
      throw new Error(`Target base not found: ${base_id}`);
    }

    const { progressCallback } = options;

    try {
      // Step 1: Handle table deletions first (this cascades to delete columns)
      progressCallback?.('Deleting tables', 10);
      await handleTableDeletions(targetContext, metaDiff, base, ncMeta);

      // Step 2: Handle standalone column deletions (columns deleted from existing tables)
      progressCallback?.('Deleting columns', 20);
      await handleStandaloneColumnDeletions(
        targetContext,
        metaDiff,
        base,
        ncMeta,
      );

      // Step 3: Handle table creations with their columns
      progressCallback?.('Creating tables', 40);
      await handleTableCreations(targetContext, metaDiff, base, ncMeta);

      // Step 4: Handle standalone column additions (columns added to existing tables)
      progressCallback?.('Adding columns', 60);
      await handleStandaloneColumnAdditions(
        targetContext,
        metaDiff,
        base,
        ncMeta,
      );

      // Step 5: Handle table and column updates
      progressCallback?.('Updating tables and columns', 70);
      await handleTableUpdates(targetContext, metaDiff, base_id, ncMeta);
      await handleColumnUpdates(targetContext, metaDiff, base_id, ncMeta);

      // Step 6: Handle all non-DDL metadata changes
      progressCallback?.('Applying metadata changes', 90);
      await handleNonDDLChanges(targetContext, metaDiff, base_id, ncMeta);

      // Step 7: Create missing indexes
      progressCallback?.('Creating indexes', 95);
      await createMissingIndexes(targetContext, metaDiff, base, ncMeta);

      // NOTE: Cache clearing intentionally omitted here.
      // Cache is not transactional — callers must call NocoCache.clear(targetContext)
      // both AFTER commit (so concurrent reads during the transaction cannot cache stale
      // pre-commit DB state) AND AFTER rollback (so any cache entries written during the
      // aborted transaction are evicted).
      //
      // Callers are also responsible for broadcasting base_meta_reload AFTER
      // committing — broadcasting here is premature and causes stale reloads.

      progressCallback?.('Completed', 100);
    } catch (error) {
      logger.error(
        `Failed to apply metadata changes: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to apply metadata changes: ${error.message}`);
    }
  });
}

async function handleTableDeletions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  const tablesToDelete = metaDiff.delete[MetaTable.MODELS] || [];

  for (const tableRecord of tablesToDelete) {
    // For metadata-only entities (like dashboards), skip DDL operations
    if (isMetadataOnly(tableRecord.type)) {
      // Just delete the metadata record using composite key
      await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .where('base_id', targetContext.base_id)
        .delete();
      continue;
    }

    // For physical entities (tables/views), perform DDL operations
    let source = await Source.get(
      targetContext,
      tableRecord.source_id,
      false,
      ncMeta,
    );

    // If source not found (e.g., in cross-base sync), use the first source from target base
    if (!source) {
      const sources = await base.getSources(false, ncMeta);
      source = sources?.[0];
    }

    // Skip if still no source available
    if (!source) {
      logger.warn(`No source found for table deletion ${tableRecord.id}`);
      // Just delete the metadata record using composite key
      await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .where('base_id', targetContext.base_id)
        .delete();
      continue;
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

    // Get columns for this table from the diff delete data
    const tableColumns = (metaDiff.delete[MetaTable.COLUMNS] || [])
      .filter((c) => c.fk_model_id === tableRecord.id)
      .filter((c) => isPhysicalCol(c));

    // Prepare table for SQL operation
    const tableForSQL = {
      ...tableRecord,
      tn: tableRecord.table_name,
      columns: tableColumns.map((c) => ({
        ...c,
        cn: c.column_name,
        tn: tableRecord.table_name, // Add table name to each column
      })),
    };

    // Perform SQL operation to drop table
    try {
      if (tableRecord.type === ModelTypes.TABLE) {
        await sqlMgr.sqlOpPlus(source, 'tableDelete', tableForSQL);
      } else if (tableRecord.type === ModelTypes.VIEW) {
        await sqlMgr.sqlOpPlus(source, 'viewDelete', {
          ...tableForSQL,
          view_name: tableRecord.table_name,
        });
      }
    } catch (error) {
      // If table doesn't exist (42P01), that's okay - it was already deleted
      if (error.code === '42P01') {
        logger.warn(
          `Table ${tableRecord.table_name} already deleted, skipping DDL`,
        );
      } else {
        throw error;
      }
    }

    // Delete the table metadata
    // (column metadata is cleaned up by handleStandaloneColumnDeletions)
    await ncMeta
      .knex(MetaTable.MODELS)
      .where('id', tableRecord.id)
      .where('base_id', targetContext.base_id)
      .delete();
  }
}

async function handleStandaloneColumnDeletions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  const columnsToDelete = metaDiff.delete[MetaTable.COLUMNS] || [];
  const deletedTableIds = new Set(
    (metaDiff.delete[MetaTable.MODELS] || []).map((t) => t.id),
  );

  for (const columnRecord of columnsToDelete) {
    // Columns belonging to deleted tables only need metadata cleanup (no DDL —
    // the physical table was already dropped by handleTableDeletions)
    if (deletedTableIds.has(columnRecord.fk_model_id)) {
      await ncMeta
        .knex(MetaTable.COLUMNS)
        .where('id', columnRecord.id)
        .where('base_id', targetContext.base_id)
        .delete();
      continue;
    }

    // Check if the parent table still exists
    const parentTable = await Model.get(
      targetContext,
      columnRecord.fk_model_id,
      false,
      ncMeta,
    );

    if (parentTable && isPhysicalCol(columnRecord)) {
      await parentTable.getColumns(targetContext, ncMeta);

      // Check if the column still exists in the current table metadata
      const columnStillExists = parentTable.columns.some(
        (c) =>
          c.id === columnRecord.id ||
          c.column_name === columnRecord.column_name,
      );

      // Only attempt DDL operation if column exists
      if (columnStillExists) {
        // Get source - try from parent table first, fallback to base's sources
        let source = await Source.get(
          targetContext,
          parentTable.source_id,
          false,
          ncMeta,
        );

        // If source not found (e.g., in cross-base sync), use the first source from target base
        if (!source) {
          const sources = await base.getSources(false, ncMeta);
          source = sources?.[0];
        }

        // Skip if still no source available
        if (!source) {
          logger.warn(
            `No source found for column deletion in table ${parentTable.id}`,
          );
          continue;
        }

        const sqlMgr = await ProjectMgrv2.getSqlMgr(
          targetContext,
          base,
          ncMeta,
        );

        const tableUpdateBody = {
          ...parentTable,
          tn: parentTable.table_name,
          originalColumns: [
            ...parentTable.columns.map((c) => ({
              ...c,
              cn: c.column_name,
              tn: parentTable.table_name, // Add table name to each column
            })),
            // Include the deleted column in originalColumns so PG client can find it
            {
              ...columnRecord,
              cn: columnRecord.column_name,
              tn: parentTable.table_name,
            },
          ],
          columns: [
            ...parentTable.columns.map((c) => ({
              ...c,
              cn: c.column_name,
              tn: parentTable.table_name, // Add table name to each column
            })),
            {
              ...columnRecord,
              cn: columnRecord.column_name,
              cno: columnRecord.column_name, // Set cno for PG client to match against originalColumns
              tn: parentTable.table_name, // Add table name to the deleted column
              altered: Altered.DELETE_COLUMN,
            },
          ],
        };

        try {
          await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
        } catch (error) {
          // 42703: column doesn't exist (already deleted)
          // 42P01: table doesn't exist (already dropped by handleTableDeletions or missing)
          if (error.code === '42703' || error.code === '42P01') {
            logger.warn(
              `Column ${columnRecord.column_name} or table ${parentTable.table_name} already deleted, skipping DDL`,
            );
          } else {
            throw error;
          }
        }
      } else {
        logger.debug(
          `Column ${columnRecord.column_name} already removed from ${parentTable.table_name} metadata, skipping DDL`,
        );
      }
    }

    // Delete the column metadata (idempotent - won't fail if already deleted) using composite key
    await ncMeta
      .knex(MetaTable.COLUMNS)
      .where('id', columnRecord.id)
      .where('base_id', targetContext.base_id)
      .delete();
  }
}

async function handleTableCreations(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  const tablesToAdd = metaDiff.add[MetaTable.MODELS] || [];

  for (const tableRecord of tablesToAdd) {
    try {
      // Check if table metadata already exists (idempotency check)
      const existingTable = await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .where('base_id', targetContext.base_id)
        .first();

      const insertedTableId = tableRecord.id;

      if (!existingTable) {
        // Extract pgSerialLastVal before insertion
        const pgSerialLastVal = tableRecord.pgSerialLastVal;

        // Prepare table record for insertion (exclude pgSerialLastVal)
        const { pgSerialLastVal: _, ...tableToInsert } = {
          ...tableRecord,
          base_id: targetContext.base_id,
        };

        // Insert table metadata
        await ncMeta.knex(MetaTable.MODELS).insert(tableToInsert);

        // Store pgSerialLastVal for later use
        tableRecord.pgSerialLastVal = pgSerialLastVal;
      } else {
        logger.debug(
          `Table ${tableRecord.table_name} metadata already exists, skipping metadata insertion`,
        );
      }

      // For metadata-only entities (like dashboards), skip column and DDL operations
      if (isMetadataOnly(tableRecord.type)) {
        continue;
      }

      // Get all columns for this new table
      const tableColumns = (metaDiff.add[MetaTable.COLUMNS] || []).filter(
        (c) => c.fk_model_id === tableRecord.id,
      );

      // Insert all column metadata for this table (check for existing columns)
      for (const columnRecord of tableColumns) {
        const existingColumn = await ncMeta
          .knex(MetaTable.COLUMNS)
          .where('id', columnRecord.id)
          .where('base_id', targetContext.base_id)
          .first();

        if (!existingColumn) {
          const columnToInsert = {
            ...columnRecord,
            base_id: targetContext.base_id,
            fk_model_id: insertedTableId,
          };

          await ncMeta.knex(MetaTable.COLUMNS).insert(columnToInsert);
        } else {
          logger.debug(
            `Column ${columnRecord.column_name} metadata already exists, skipping`,
          );
        }
      }

      // Now perform SQL operation to create table with all its columns
      const source = await Source.get(
        targetContext,
        tableRecord.source_id,
        false,
        ncMeta,
      );

      if (!source) {
        throw new Error(`Source not found: ${tableRecord.source_id}`);
      }

      const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

      // Filter out virtual columns for SQL operation
      const physicalColumns = tableColumns
        .filter((c) => isPhysicalCol(c))
        .map((c) => ({
          ...c,
          cn: c.column_name,
          tn: tableRecord.table_name, // Add table name to each column
        }));

      const tablePayload = {
        ...tableRecord,
        tn: tableRecord.table_name,
        columns: physicalColumns,
      };

      // Only create physical table if it's not a view and has physical columns
      if (tableRecord.type === ModelTypes.TABLE && physicalColumns.length > 0) {
        let tableCreated = false;
        try {
          await sqlMgr.sqlOpPlus(source, 'tableCreate', tablePayload);
          tableCreated = true;
        } catch (error) {
          // If table already exists in database (42P07), that's okay
          if (error.code === '42P07') {
            logger.warn(
              `Table ${tableRecord.table_name} already exists in database, skipping DDL`,
            );
          } else {
            throw error;
          }
        }

        // Set PostgreSQL sequence value for auto-increment columns (only if table was just created or if pgSerialLastVal exists)
        if (tableCreated && tableRecord.pgSerialLastVal) {
          try {
            const table = await Model.get(
              targetContext,
              insertedTableId,
              false,
              ncMeta,
            );
            if (table) {
              await setPostgresSequenceValue(targetContext, {
                table,
                columns: tableColumns,
                source,
                pgSerialLastVal: tableRecord.pgSerialLastVal,
              });
            }
          } catch (error) {
            logger.warn(
              `Failed to set PostgreSQL sequence for ${tableRecord.table_name}: ${error.message}`,
            );
            // Don't throw - this is not critical
          }
        }
      } else if (tableRecord.type === ModelTypes.VIEW) {
        try {
          // Handle view creation if needed
          await sqlMgr.sqlOpPlus(source, 'viewCreate', {
            ...tablePayload,
            view_name: tableRecord.table_name,
          });
        } catch (error) {
          // If view already exists, that's okay
          if (error.code === '42P07') {
            logger.warn(
              `View ${tableRecord.table_name} already exists in database, skipping DDL`,
            );
          } else {
            throw error;
          }
        }
      }

      // Note: Indexes will be created after all metadata is applied
    } catch (error) {
      // Only throw if it's not an idempotency-related error that we've already handled
      if (error.code !== '42P07' && error.code !== '42701') {
        logger.error(
          `Failed to create table ${tableRecord.table_name}: ${error.message}`,
          error.stack,
        );
        throw new Error(
          `Failed to create table ${tableRecord.table_name}: ${error.message}`,
        );
      } else {
        // Log but don't throw for already-exists errors
        logger.debug(
          `Skipped table ${tableRecord.table_name} creation due to existing object`,
        );
      }
    }
  }
}

async function handleStandaloneColumnAdditions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  const columnsToAdd = metaDiff.add[MetaTable.COLUMNS] || [];
  const newTableIds = new Set(
    (metaDiff.add[MetaTable.MODELS] || []).map((t) => t.id),
  );

  for (const columnRecord of columnsToAdd) {
    try {
      // Skip columns that belong to new tables (already handled)
      if (newTableIds.has(columnRecord.fk_model_id)) {
        continue;
      }

      // Check if column metadata already exists (idempotency check)
      const existingColumn = await ncMeta
        .knex(MetaTable.COLUMNS)
        .where('id', columnRecord.id)
        .where('base_id', targetContext.base_id)
        .first();

      if (!existingColumn) {
        // Prepare column record for insertion
        const columnToInsert = {
          ...columnRecord,
          base_id: targetContext.base_id,
        };

        // Insert column metadata
        await ncMeta.knex(MetaTable.COLUMNS).insert(columnToInsert);
      } else {
        logger.debug(
          `Column ${columnRecord.column_name} metadata already exists, skipping metadata insertion`,
        );
      }

      // Perform SQL operation for non-virtual columns
      if (isPhysicalCol(columnRecord)) {
        const parentTable = await Model.get(
          targetContext,
          columnRecord.fk_model_id,
          false,
          ncMeta,
        );

        if (parentTable) {
          await parentTable.getColumns(targetContext, ncMeta);

          // Check if column already exists in table (avoid duplicate column error)
          const columnAlreadyExists = parentTable.columns.some(
            (c) =>
              c.id === columnRecord.id ||
              c.column_name === columnRecord.column_name,
          );

          if (!columnAlreadyExists) {
            const source = await Source.get(
              targetContext,
              parentTable.source_id,
              false,
              ncMeta,
            );

            if (!source) {
              throw new Error(`Source not found: ${parentTable.source_id}`);
            }

            const sqlMgr = await ProjectMgrv2.getSqlMgr(
              targetContext,
              base,
              ncMeta,
            );

            const tableUpdateBody = {
              ...parentTable,
              tn: parentTable.table_name,
              originalColumns: parentTable.columns.map((c) => ({
                ...c,
                cn: c.column_name,
                tn: parentTable.table_name, // Add table name to each column
              })),
              columns: [
                ...parentTable.columns.map((c) => ({
                  ...c,
                  cn: c.column_name,
                  tn: parentTable.table_name, // Add table name to each column
                })),
                {
                  ...columnRecord,
                  cn: columnRecord.column_name,
                  tn: parentTable.table_name, // Add table name to the new column
                  altered: Altered.NEW_COLUMN,
                },
              ],
            };

            try {
              await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);

              // Handle foreign key constraint creation for non-virtual FK columns
              await createForeignKeyConstraint(
                targetContext,
                columnRecord,
                parentTable,
                source,
                base,
                ncMeta,
              );
            } catch (error) {
              // 42701: column already exists
              // 42P01: table doesn't exist (already dropped or missing)
              if (error.code === '42701' || error.code === '42P01') {
                logger.warn(
                  `Column ${columnRecord.column_name} already exists in or table ${parentTable.table_name} not found, skipping DDL`,
                );
              } else {
                throw error;
              }
            }
          } else {
            logger.debug(
              `Column ${columnRecord.column_name} already exists in ${parentTable.table_name}, skipping DDL`,
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        `Failed to add column ${columnRecord.column_name}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to add column ${columnRecord.column_name}: ${error.message}`,
      );
    }
  }
}

async function handleTableUpdates(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base_id: string,
  ncMeta = Noco.ncMeta,
) {
  const tablesToUpdate = metaDiff.update[MetaTable.MODELS] || [];
  const base = await Base.get(targetContext, base_id, ncMeta);

  for (const tableRecord of tablesToUpdate) {
    try {
      // Get the existing table record to compare changes
      const existingTable = await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .where('base_id', base_id)
        .first();

      if (!existingTable) {
        logger.warn(`Table not found for update: ${tableRecord.id}`);
        continue;
      }

      // For metadata-only entities (like dashboards), skip DDL operations
      if (!isMetadataOnly(tableRecord.type)) {
        // Check if table_name has changed (requires DDL operation)
        if (existingTable.table_name !== tableRecord.table_name) {
          const source = await Source.get(
            targetContext,
            tableRecord.source_id,
            false,
            ncMeta,
          );

          if (source) {
            const sqlMgr = await ProjectMgrv2.getSqlMgr(
              targetContext,
              base,
              ncMeta,
            );

            // Perform DDL operation to rename table
            if (existingTable.type === ModelTypes.TABLE) {
              await sqlMgr.sqlOpPlus(source, 'tableRename', {
                ...tableRecord,
                tn: tableRecord.table_name,
                tn_old: existingTable.table_name,
                schema: source.getConfig()?.schema,
              });
            }
          }
        }
      }

      // Update the table metadata using composite key
      const { id, pgSerialLastVal, ...updateData } = tableRecord;
      await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', id)
        .where('base_id', base_id)
        .update({ ...updateData, base_id });
    } catch (error) {
      logger.error(
        `Failed to update table ${tableRecord.table_name}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to update table ${tableRecord.table_name}: ${error.message}`,
      );
    }
  }
}

async function handleColumnUpdates(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base_id: string,
  ncMeta = Noco.ncMeta,
) {
  const columnsToUpdate = metaDiff.update[MetaTable.COLUMNS] || [];

  // Skip columns whose parent table is being deleted or created — those are handled elsewhere
  const deletedTableIds = new Set(
    (metaDiff.delete[MetaTable.MODELS] || []).map((t) => t.id),
  );
  const newTableIds = new Set(
    (metaDiff.add[MetaTable.MODELS] || []).map((t) => t.id),
  );

  const base = await Base.get(targetContext, base_id, ncMeta);

  for (const columnRecord of columnsToUpdate) {
    if (
      deletedTableIds.has(columnRecord.fk_model_id) ||
      newTableIds.has(columnRecord.fk_model_id)
    ) {
      continue;
    }

    try {
      // Get the existing column record to compare changes
      const existingColumn = await Column.get(
        targetContext,
        { colId: columnRecord.id },
        ncMeta,
      );

      if (!existingColumn) {
        logger.warn(`Column not found for update: ${columnRecord.id}`);
        continue;
      }

      // Check if this is a physical column that needs DDL operations
      if (isPhysicalCol(columnRecord) && isPhysicalCol(existingColumn)) {
        // Get the parent table
        const parentTable = await Model.get(
          targetContext,
          columnRecord.fk_model_id,
          false,
          ncMeta,
        );

        if (parentTable) {
          await parentTable.getColumns(targetContext, ncMeta);

          const source = await Source.get(
            targetContext,
            parentTable.source_id,
            false,
            ncMeta,
          );

          if (source) {
            const sqlMgr = await ProjectMgrv2.getSqlMgr(
              targetContext,
              base,
              ncMeta,
            );

            // Check if column properties that require DDL have changed
            const needsDDLUpdate =
              existingColumn.column_name !== columnRecord.column_name ||
              existingColumn.dt !== columnRecord.dt ||
              existingColumn.dtxp !== columnRecord.dtxp ||
              existingColumn.dtxs !== columnRecord.dtxs ||
              existingColumn.rqd !== columnRecord.rqd ||
              existingColumn.cdf !== columnRecord.cdf ||
              existingColumn.un !== columnRecord.un ||
              existingColumn.ai !== columnRecord.ai ||
              existingColumn.pk !== columnRecord.pk;

            if (needsDDLUpdate) {
              // Prepare table update body with column changes
              const tableUpdateBody = {
                ...parentTable,
                tn: parentTable.table_name,
                originalColumns: parentTable.columns.map((c) => ({
                  ...c,
                  cn: c.column_name,
                  cno: c.column_name,
                })),
                columns: parentTable.columns.map((c) => {
                  if (c.id === columnRecord.id) {
                    return {
                      ...c,
                      ...columnRecord,
                      cn: columnRecord.column_name,
                      cno: existingColumn.column_name, // Original column name
                      altered: Altered.UPDATE_COLUMN,
                    };
                  } else {
                    return {
                      ...c,
                      cn: c.column_name,
                    };
                  }
                }),
              };

              // Perform DDL operation
              try {
                await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
              } catch (error) {
                // 42P01: table doesn't exist (already dropped or missing)
                if (error.code === '42P01') {
                  logger.warn(
                    `Table ${parentTable.table_name} not found for column update of ${columnRecord.column_name}, skipping DDL`,
                  );
                } else {
                  throw error;
                }
              }
            }
          }
        }
      }

      // Update the column metadata using composite key
      const { id, ...updateData } = columnRecord;
      await ncMeta
        .knex(MetaTable.COLUMNS)
        .where('id', id)
        .where('base_id', base_id)
        .update({ ...updateData, base_id });
    } catch (error) {
      logger.error(
        `Failed to update column ${columnRecord.column_name}: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Failed to update column ${columnRecord.column_name}: ${error.message}`,
      );
    }
  }
}

async function handleNonDDLChanges(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base_id: string,
  ncMeta = Noco.ncMeta,
) {
  const ddlTables = [MetaTable.MODELS, MetaTable.COLUMNS];
  const errors: { table: string; op: string; message: string }[] = [];

  // Process tables in dependency order
  for (const metaTable of orderedSerializableMetaTables) {
    if (ddlTables.includes(metaTable)) {
      continue; // Skip DDL tables, already handled
    }

    try {
      const toDelete = metaDiff.delete[metaTable] || [];
      const toUpdate = metaDiff.update[metaTable] || [];
      const toAdd = metaDiff.add[metaTable] || [];

      // Handle deletions first
      for (const record of toDelete) {
        try {
          const pkFields = tablePrimaryKeys[metaTable] || 'id';

          // Build the where clause based on primary key type
          let whereClause: any;
          if (Array.isArray(pkFields)) {
            // Composite primary key
            whereClause = {};
            for (const field of pkFields) {
              whereClause[field] = record[field];
            }
          } else {
            // Single primary key
            whereClause = { [pkFields]: record[pkFields] };
          }

          // Always add base_id filter for data isolation
          await ncMeta
            .knex(metaTable)
            .where(whereClause)
            .where('base_id', base_id)
            .delete();
        } catch (error) {
          errors.push({
            table: metaTable,
            op: 'delete',
            message: error.message,
          });
        }
      }

      // Handle updates
      for (const record of toUpdate) {
        try {
          const pkFields = tablePrimaryKeys[metaTable] || 'id';
          let updateData = { ...record };

          // For MODELS table, exclude pgSerialLastVal as it's not a real column
          if (
            metaTable === MetaTable.MODELS &&
            'pgSerialLastVal' in updateData
          ) {
            const { pgSerialLastVal, ...rest } = updateData;
            updateData = rest;
          }

          // Build the where clause based on primary key type
          let whereClause: any;
          if (Array.isArray(pkFields)) {
            // Composite primary key
            whereClause = {};
            for (const field of pkFields) {
              whereClause[field] = record[field];
              delete updateData[field]; // Don't update PK fields
            }
          } else {
            // Single primary key
            whereClause = { [pkFields]: record[pkFields] };
            delete updateData[pkFields]; // Don't update PK field
          }

          // Skip if no primary key values found
          if (
            Object.keys(whereClause).length === 0 ||
            Object.values(whereClause).some((v) => v === undefined)
          ) {
            logger.warn(
              `Skipping update for ${metaTable} record without valid primary key`,
            );
            continue;
          }

          await ncMeta
            .knex(metaTable)
            .where(whereClause)
            .where('base_id', base_id)
            .update({ ...updateData, base_id });
        } catch (error) {
          errors.push({
            table: metaTable,
            op: 'update',
            message: error.message,
          });
        }
      }

      // Handle additions (with idempotency check)
      for (const record of toAdd) {
        try {
          const pkFields = tablePrimaryKeys[metaTable] || 'id';

          // Build where clause to check if record already exists
          let whereClause: any;
          if (Array.isArray(pkFields)) {
            whereClause = {};
            for (const field of pkFields) {
              whereClause[field] = record[field];
            }
          } else {
            whereClause = { [pkFields]: record[pkFields] };
          }

          const existing = await ncMeta
            .knex(metaTable)
            .where(whereClause)
            .where('base_id', base_id)
            .first();

          if (existing) {
            continue; // Already exists — skip for idempotency
          }

          const recordToInsert = { ...record, base_id };
          await ncMeta.knex(metaTable).insert(recordToInsert);
        } catch (error) {
          errors.push({
            table: metaTable,
            op: 'add',
            message: error.message,
          });
        }
      }
    } catch (error) {
      logger.error(
        `Failed to process ${metaTable}: ${error.message}`,
        error.stack,
      );
      // Continue with other tables
    }
  }

  if (errors.length) {
    logger.warn(
      `handleNonDDLChanges completed with ${
        errors.length
      } error(s): ${JSON.stringify(errors)}`,
    );
  }
}

async function createOrderIndexForTable(
  targetContext: NcContext,
  tableRecord: Model,
  tableColumns: Column[],
  base: Base,
  source: Source,
  ncMeta = Noco.ncMeta,
) {
  try {
    // Find the order column
    const metaOrderColumn = tableColumns.find((c) => c.uidt === UITypes.Order);

    if (!metaOrderColumn) {
      return;
    }

    // Get the actual model and column objects
    const model = await Model.get(targetContext, tableRecord.id, false, ncMeta);
    if (!model) {
      logger.warn(`Model not found for table ${tableRecord.table_name}`);
      return;
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

    const indexName = `${tableRecord.table_name}_order_idx`;

    try {
      await sqlMgr.sqlOpPlus(source, 'indexCreate', {
        columns: [metaOrderColumn.column_name],
        tn: model.table_name,
        non_unique: true,
        indexName,
      });
    } catch (indexError) {
      // If index already exists (42P07), that's okay
      if (indexError.code === '42P07') {
        logger.debug(
          `Index ${indexName} already exists for ${tableRecord.table_name}, skipping`,
        );
      } else {
        throw indexError;
      }
    }
  } catch (e) {
    // Log the error but don't fail the entire operation
    logger.error(
      `Failed to create order index for ${tableRecord.table_name}: ${e.message}`,
      e.stack,
    );
  }
}

async function createForeignKeyIndexesForTable(
  targetContext: NcContext,
  tableRecord: Model,
  tableColumns: Column[],
  source: Source,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  try {
    // Find foreign key columns that need indexes
    const fkColumns = tableColumns.filter(
      (c) => c.uidt === UITypes.ForeignKey && !isVirtualCol(c),
    );

    for (const fkColumn of fkColumns) {
      try {
        // Get the actual column object
        const column = await Column.get(
          targetContext,
          { colId: fkColumn.id },
          ncMeta,
        );
        if (!column) {
          logger.warn(`Column not found for FK ${fkColumn.column_name}`);
          continue;
        }

        // Get the model
        const model = await column.getModel(targetContext, ncMeta);
        if (!model) {
          logger.warn(`Model not found for FK column ${fkColumn.column_name}`);
          continue;
        }

        // Find the related LTAR column to get the proper index name
        const ltarColumn = await ncMeta
          .knex(MetaTable.COL_RELATIONS)
          .where('base_id', tableRecord.base_id)
          .andWhere(function () {
            this.where('fk_child_column_id', fkColumn.id).orWhere(
              'fk_parent_column_id',
              fkColumn.id,
            );
          })
          .first();

        let indexName;
        if (ltarColumn && ltarColumn.fk_index_name) {
          indexName = ltarColumn.fk_index_name;
        } else {
          // Fallback to a generated name
          indexName = `fk_${tableRecord.table_name}_${fkColumn.column_name}`;
        }

        // Use the ColumnsService approach for creating FK indexes
        const sqlMgr = await ProjectMgrv2.getSqlMgr(
          targetContext,
          base,
          ncMeta,
        );

        const indexArgs = {
          columns: [column.column_name],
          tn: model.table_name,
          non_unique: true,
          indexName,
        };

        try {
          await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
        } catch (indexError) {
          // If index already exists (42P07), that's okay
          if (indexError.code === '42P07') {
            logger.debug(
              `Index ${indexName} already exists for ${fkColumn.column_name}, skipping`,
            );
          } else {
            throw indexError;
          }
        }
      } catch (e) {
        logger.warn(
          `Failed to create FK index for ${fkColumn.column_name}: ${e.message}`,
        );
        // Continue with other indexes
      }
    }
  } catch (e) {
    logger.error(
      `Failed to create FK indexes for ${tableRecord.table_name}: ${e.message}`,
      e.stack,
    );
  }
}

async function createForeignKeyConstraint(
  targetContext: NcContext,
  columnRecord: Column,
  parentTable: Model,
  source: Source,
  base: Base,
  ncMeta = Noco.ncMeta,
) {
  try {
    // Skip ForeignKey columns — they don't need index creation here
    if (columnRecord.uidt === UITypes.ForeignKey) {
      return;
    }

    // Get the related table and column information from the column metadata
    // For foreign keys, we need to find the related LinkToAnotherRecord column
    const relatedLinkColumn = await ncMeta
      .knex(MetaTable.COL_RELATIONS)
      .where('base_id', parentTable.base_id)
      .andWhere(function () {
        this.where('fk_child_column_id', columnRecord.id).orWhere(
          'fk_parent_column_id',
          columnRecord.id,
        );
      })
      .first();

    if (!relatedLinkColumn) {
      return;
    }

    const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

    // Create the foreign key constraint name from the link column's fk_index_name
    const constraintName =
      relatedLinkColumn.fk_index_name ||
      `fk_${parentTable.table_name}_${columnRecord.column_name}`;

    // For foreign key creation, we typically create an index as well
    // This matches what NocoDB does in the services
    await createColumnIndex(targetContext, {
      column: columnRecord,
      sqlMgr,
      source,
      indexName: constraintName,
      tableName: parentTable.table_name,
    });
  } catch (e) {
    // Log the error but don't fail the entire operation
    logger.error(
      `Failed to create foreign key constraint: ${e.message}`,
      e.stack,
    );
  }
}

// New function to create missing indexes after metadata is applied
async function createMissingIndexes(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: Base,
  ncMeta = Noco.ncMeta,
): Promise<void> {
  try {
    const tablesToAdd = metaDiff.add[MetaTable.MODELS] || [];

    for (const tableRecord of tablesToAdd) {
      try {
        // Skip index creation for metadata-only entities (like dashboards)
        if (isMetadataOnly(tableRecord.type)) {
          continue;
        }

        // Get the source for this table
        const source = await Source.get(
          targetContext,
          tableRecord.source_id as string,
          false,
          ncMeta,
        );

        if (!source) {
          continue;
        }

        // Get all columns for this table
        const tableColumns = (metaDiff.add[MetaTable.COLUMNS] || []).filter(
          (c) => c.fk_model_id === tableRecord.id,
        );

        // Create order index
        await createOrderIndexForTable(
          targetContext,
          tableRecord,
          tableColumns,
          base,
          source,
          ncMeta,
        );

        // Create foreign key indexes
        await createForeignKeyIndexesForTable(
          targetContext,
          tableRecord,
          tableColumns,
          source,
          base,
          ncMeta,
        );
      } catch (error) {
        logger.warn(
          `Failed to create indexes for table ${tableRecord.table_name}: ${error.message}`,
        );
        // Continue with other tables
      }
    }
  } catch (error) {
    logger.error(
      `Failed to create missing indexes: ${error.message}`,
      error.stack,
    );
    // Don't throw - index creation failures shouldn't break the entire operation
  }
}
