import hash from 'object-hash';
import { EventType, isVirtualCol, ModelTypes, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import Noco from '~/Noco';
import { BaseRelatedMetaTables, MetaTable } from '~/utils/globals';
import { Base, Column, Model, Source } from '~/models';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import NocoCache from '~/cache/NocoCache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoSocket from '~/socket/NocoSocket';

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
  return [ModelTypes.DASHBOARD, ModelTypes.VIEW].includes(modelType);
};

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
  [MetaTable.MODEL_STAT]: ['fk_workspace_id', 'base_id', 'fk_model_id'],
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

  // Filters and sorts
  MetaTable.FILTER_EXP,
  MetaTable.SORT,

  // Hooks and extensions
  MetaTable.HOOKS,
  MetaTable.EXTENSIONS,

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

  // Scripts and workflows
  MetaTable.AUTOMATIONS,
  MetaTable.DEPENDENCY_TRACKER,

  // Statistics
  MetaTable.MODEL_STAT,
].filter((table) => serializableMetaTables.includes(table));

export const skipOverrideTables = [MetaTable.DEPENDENCY_TRACKER];

export type BaseMetaSchema = {
  [K in (typeof serializableMetaTables)[number]]?: any;
};

export type BaseMetaDiff = {
  add: BaseMetaSchema;
  delete: BaseMetaSchema;
  update: BaseMetaSchema;
};

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
        const records = await ncMeta
          .knex(metaTable)
          .where('base_id', base_id)
          .orderBy('created_at', 'asc')
          .select();

        // Apply overrides if provided (for changing base_id/workspace_id/source_id)
        if (
          override &&
          records.length > 0 &&
          !skipOverrideTables.includes(metaTable)
        ) {
          for (const record of records) {
            // Only override specified fields, preserve all other data
            if (override.base_id !== undefined) {
              record.base_id = override.base_id;
            }
            if (override.fk_workspace_id !== undefined) {
              record.fk_workspace_id = override.fk_workspace_id;
            }
            if (
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
              const oldRegexp = new RegExp(`^${prefix.old}`);
              record.table_name = record.table_name.replace(
                oldRegexp,
                prefix.new,
              );
            }
          }
        }

        // Extract pgSerialLastVal for PostgreSQL tables
        if (metaTable === MetaTable.MODELS && records.length > 0) {
          const base = await Base.get(sourceContext, base_id);
          if (base) {
            for (const record of records) {
              if (record.type === ModelTypes.TABLE) {
                const source = await Source.get(
                  sourceContext,
                  record.source_id,
                );
                if (source?.type === 'pg') {
                  try {
                    const model = await Model.get(
                      sourceContext,
                      record.id,
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
                    console.error(
                      `Failed to extract pgSerialLastVal for table ${record.table_name}:`,
                      error,
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
        console.error(`Failed to serialize table ${metaTable}:`, error);
        // Continue with other tables, but log the error
        baseSchema[metaTable] = [];
      }
    }

    return baseSchema;
  } catch (error) {
    console.error('Failed to serialize base metadata:', error);
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
          return hash(oldRecord) !== hash(r);
        } catch (error) {
          console.warn(
            `Hash comparison failed for ${metaTable} record ${key}:`,
            error,
          );
          // Fallback to JSON comparison
          return JSON.stringify(oldRecord) !== JSON.stringify(r);
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
    console.error('Failed to diff base metadata:', error);
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
    console.error(
      `Failed to set PostgreSQL sequence value for table ${table.table_name}:`,
      error,
    );
    // Don't throw - this is not critical enough to fail the entire operation
  }
}

export async function applyMeta(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  ncMeta = Noco.ncMeta,
  options: {
    progressCallback?: (step: string, progress: number) => void;
  } = {},
): Promise<void> {
  const base_id = targetContext.base_id;

  if (!base_id) {
    throw new Error('Target base ID is required');
  }

  const base = await Base.get(targetContext, base_id);
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

    // Step 8: Clear relevant caches
    progressCallback?.('Clearing caches', 98);
    await clearRelatedCaches(targetContext);

    await NocoCache.destroy();

    // Step 9: Broadcast realtime event to trigger UI reload
    progressCallback?.('Broadcasting changes', 99);
    NocoSocket.broadcastEvent(
      targetContext,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'base_full_reload',
          payload: {
            base_id: base_id,
          },
        },
      },
      targetContext.socket_id,
    );

    progressCallback?.('Completed', 100);
  } catch (error) {
    console.error('Failed to apply metadata changes:', error);
    throw new Error(`Failed to apply metadata changes: ${error.message}`);
  }
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
      console.warn(`No source found for table deletion ${tableRecord.id}`);
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
        console.warn(
          `Table ${tableRecord.table_name} already deleted, skipping DDL`,
        );
      } else {
        throw error;
      }
    }

    // Delete the table metadata (columns will be cascade deleted) using composite key
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
    // Skip columns that belong to deleted tables (already handled)
    if (deletedTableIds.has(columnRecord.fk_model_id)) {
      continue;
    }

    // Check if the parent table still exists
    const parentTable = await Model.get(
      targetContext,
      columnRecord.fk_model_id,
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
          console.warn(
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
          // If column doesn't exist in database (42703), that's okay - it was already deleted
          if (error.code === '42703') {
            console.warn(
              `Column ${columnRecord.column_name} already deleted from ${parentTable.table_name}, skipping DDL`,
            );
          } else {
            throw error;
          }
        }
      } else {
        console.log(
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
        console.log(
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
          console.log(
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
            console.warn(
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
            console.warn(
              `Failed to set PostgreSQL sequence for ${tableRecord.table_name}:`,
              error,
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
            console.warn(
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
        console.error(
          `Failed to create table ${tableRecord.table_name}:`,
          error,
        );
        throw new Error(
          `Failed to create table ${tableRecord.table_name}: ${error.message}`,
        );
      } else {
        // Log but don't throw for already-exists errors
        console.log(
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
        console.log(
          `Column ${columnRecord.column_name} metadata already exists, skipping metadata insertion`,
        );
      }

      // Perform SQL operation for non-virtual columns
      if (isPhysicalCol(columnRecord)) {
        const parentTable = await Model.get(
          targetContext,
          columnRecord.fk_model_id,
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
              // If column already exists in database (42701), that's okay
              if (error.code === '42701') {
                console.warn(
                  `Column ${columnRecord.column_name} already exists in ${parentTable.table_name}, skipping DDL`,
                );
              } else {
                throw error;
              }
            }
          } else {
            console.log(
              `Column ${columnRecord.column_name} already exists in ${parentTable.table_name}, skipping DDL`,
            );
          }
        }
      }
    } catch (error) {
      console.error(`Failed to add column ${columnRecord.column_name}:`, error);
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

  for (const tableRecord of tablesToUpdate) {
    try {
      // Get the existing table record to compare changes
      const existingTable = await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .where('base_id', base_id)
        .first();

      if (!existingTable) {
        console.warn(`Table not found for update: ${tableRecord.id}`);
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
            const base = await Base.get(targetContext, base_id);
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
      console.error(`Failed to update table ${tableRecord.table_name}:`, error);
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

  for (const columnRecord of columnsToUpdate) {
    try {
      // Get the existing column record to compare changes
      const existingColumn = await Column.get(
        targetContext,
        { colId: columnRecord.id },
        ncMeta,
      );

      if (!existingColumn) {
        console.warn(`Column not found for update: ${columnRecord.id}`);
        continue;
      }

      // Check if this is a physical column that needs DDL operations
      if (isPhysicalCol(columnRecord) && isPhysicalCol(existingColumn)) {
        // Get the parent table
        const parentTable = await Model.get(
          targetContext,
          columnRecord.fk_model_id,
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
            const base = await Base.get(targetContext, base_id);
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
              await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
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
      console.error(
        `Failed to update column ${columnRecord.column_name}:`,
        error,
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
          console.warn(`Failed to delete ${metaTable} record:`, error);
          // Continue with other deletions
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
            console.warn(
              `Skipping update for ${metaTable} record without valid primary key:`,
              record,
            );
            continue;
          }

          await ncMeta
            .knex(metaTable)
            .where(whereClause)
            .where('base_id', base_id)
            .update({ ...updateData, base_id });
        } catch (error) {
          console.warn(`Failed to update ${metaTable} record:`, error);
          // Continue with other updates
        }
      }

      // Handle additions
      for (const record of toAdd) {
        try {
          const recordToInsert = { ...record, base_id };
          await ncMeta.knex(metaTable).insert(recordToInsert);
        } catch (error) {
          console.warn(`Failed to add ${metaTable} record:`, error);
          // Continue with other additions
        }
      }
    } catch (error) {
      console.error(`Failed to process ${metaTable}:`, error);
      // Continue with other tables
    }
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
    const model = await Model.get(targetContext, tableRecord.id, ncMeta);
    if (!model) {
      console.warn(`Model not found for table ${tableRecord.table_name}`);
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
        console.log(
          `Index ${indexName} already exists for ${tableRecord.table_name}, skipping`,
        );
      } else {
        throw indexError;
      }
    }
  } catch (e) {
    // Log the error but don't fail the entire operation
    console.error(
      `Failed to create order index for ${tableRecord.table_name}:`,
      e,
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
          console.warn(`Column not found for FK ${fkColumn.column_name}`);
          continue;
        }

        // Get the model
        const model = await column.getModel(targetContext, ncMeta);
        if (!model) {
          console.warn(`Model not found for FK column ${fkColumn.column_name}`);
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
            console.log(
              `Index ${indexName} already exists for ${fkColumn.column_name}, skipping`,
            );
          } else {
            throw indexError;
          }
        }
      } catch (e) {
        console.warn(
          `Failed to create FK index for ${fkColumn.column_name}:`,
          e,
        );
        // Continue with other indexes
      }
    }
  } catch (e) {
    console.error(
      `Failed to create FK indexes for ${tableRecord.table_name}:`,
      e,
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
    // Only create foreign key constraint for UITypes.ForeignKey that are not virtual
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
    console.error('Failed to create foreign key constraint:', e);
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
        console.warn(
          `Failed to create indexes for table ${tableRecord.table_name}:`,
          error,
        );
        // Continue with other tables
      }
    }
  } catch (error) {
    console.error('Failed to create missing indexes:', error);
    // Don't throw - index creation failures shouldn't break the entire operation
  }
}

// New cache clearing function
async function clearRelatedCaches(targetContext: NcContext): Promise<void> {
  try {
    await NocoCache.clear(targetContext);
  } catch (error) {
    console.warn('Failed to clear some caches:', error);
    // Don't throw - cache clearing failures shouldn't break the operation
  }
}
