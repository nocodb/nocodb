import hash from 'object-hash';
import { isVirtualCol, ModelTypes, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import Noco from '~/Noco';
import { BaseRelatedMetaTables, MetaTable } from '~/utils/globals';
import { Base, Column, Model, Source } from '~/models';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoCache from '~/cache/NocoCache';

// Altered enum from columns service
enum Altered {
  NEW_COLUMN = 1,
  DELETE_COLUMN = 4,
  UPDATE_COLUMN = 8,
}

const serializableMetaTables = BaseRelatedMetaTables.filter(
  (t) =>
    ![
      MetaTable.COMMENTS,
      MetaTable.COMMENTS_REACTIONS,
      MetaTable.SOURCES,
    ].includes(t),
);

// Order matters for proper dependency resolution during duplication
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

  // Scripts and tokens
  MetaTable.SCRIPTS,
  MetaTable.MCP_TOKENS,

  // Statistics
  MetaTable.MODEL_STAT,
].filter((table) => serializableMetaTables.includes(table));

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
  override?: { base_id?: string; fk_workspace_id?: string },
  ncMeta = Noco.ncMeta,
): Promise<BaseMetaSchema> {
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

        // Apply overrides if provided (for changing base_id/workspace_id)
        if (override && records.length > 0) {
          for (const record of records) {
            // Only override specified fields, preserve all other data
            if (override.base_id !== undefined) {
              record.base_id = override.base_id;
            }
            if (override.fk_workspace_id !== undefined) {
              record.fk_workspace_id = override.fk_workspace_id;
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

      const oldRecordMap = new Map(oldRecords.map((r) => [r.id, r]));
      const newRecordMap = new Map(newRecords.map((r) => [r.id, r]));

      const toAdd = newRecords.filter((r) => !oldRecordMap.has(r.id));
      const toDelete = oldRecords.filter((r) => !newRecordMap.has(r.id));
      const toUpdate = newRecords.filter((r) => {
        if (!oldRecordMap.has(r.id)) return false;
        const oldRecord = oldRecordMap.get(r.id);
        try {
          return hash(oldRecord) !== hash(r);
        } catch (error) {
          console.warn(
            `Hash comparison failed for ${metaTable} record ${r.id}:`,
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
    column: any;
    sqlMgr: SqlMgrv2;
    source: Source;
    indexName: string;
    nonUnique?: boolean;
    tableName: string;
  },
) {
  // TODO: implement for snowflake (right now create index does not work with identifier quoting in snowflake - bug?)
  if (source.type === 'snowflake') return;

  const indexArgs = {
    columns: [column.column_name],
    tn: tableName,
    non_unique: nonUnique,
    indexName,
  };
  await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
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

    progressCallback?.('Completed', 100);
  } catch (error) {
    console.error('Failed to apply metadata changes:', error);
    throw new Error(`Failed to apply metadata changes: ${error.message}`);
  }
}

async function handleTableDeletions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: any,
  ncMeta: any,
) {
  const tablesToDelete = metaDiff.delete[MetaTable.MODELS] || [];

  for (const tableRecord of tablesToDelete) {
    const source = await Source.get(
      targetContext,
      tableRecord.source_id,
      false,
      ncMeta,
    );
    const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

    // Get columns for this table from the diff delete data
    const tableColumns = (metaDiff.delete[MetaTable.COLUMNS] || [])
      .filter((c) => c.fk_model_id === tableRecord.id)
      .filter((c) => !isVirtualCol(c));

    // Prepare table for SQL operation
    const tableForSQL = {
      ...tableRecord,
      tn: tableRecord.table_name,
      columns: tableColumns.map((c) => ({
        ...c,
        cn: c.column_name,
      })),
    };

    // Perform SQL operation to drop table
    if (tableRecord.type === ModelTypes.TABLE) {
      await sqlMgr.sqlOpPlus(source, 'tableDelete', tableForSQL);
    } else if (tableRecord.type === ModelTypes.VIEW) {
      await sqlMgr.sqlOpPlus(source, 'viewDelete', {
        ...tableForSQL,
        view_name: tableRecord.table_name,
      });
    }

    // Delete the table metadata (columns will be cascade deleted)
    await ncMeta.knex(MetaTable.MODELS).where('id', tableRecord.id).delete();
  }
}

async function handleStandaloneColumnDeletions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: any,
  ncMeta: any,
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

    if (parentTable && !isVirtualCol(columnRecord)) {
      await parentTable.getColumns(targetContext, ncMeta);

      const source = await Source.get(
        targetContext,
        parentTable.source_id,
        false,
        ncMeta,
      );
      const sqlMgr = await ProjectMgrv2.getSqlMgr(targetContext, base, ncMeta);

      const tableUpdateBody = {
        ...parentTable,
        tn: parentTable.table_name,
        originalColumns: parentTable.columns.map((c) => ({
          ...c,
          cn: c.column_name,
        })),
        columns: [
          ...parentTable.columns.map((c) => ({
            ...c,
            cn: c.column_name,
          })),
          {
            ...columnRecord,
            cn: columnRecord.column_name,
            altered: Altered.DELETE_COLUMN,
          },
        ],
      };

      await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
    }

    // Delete the column metadata
    await ncMeta.knex(MetaTable.COLUMNS).where('id', columnRecord.id).delete();
  }
}

async function handleTableCreations(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: any,
  ncMeta: any,
) {
  const tablesToAdd = metaDiff.add[MetaTable.MODELS] || [];

  for (const tableRecord of tablesToAdd) {
    try {
      // Prepare table record for insertion
      const tableToInsert = {
        ...tableRecord,
        base_id: targetContext.base_id,
      };

      // First, insert table metadata
      const insertedTableId = tableRecord.id;

      await ncMeta.knex(MetaTable.MODELS).insert(tableToInsert);

      // Get all columns for this new table
      const tableColumns = (metaDiff.add[MetaTable.COLUMNS] || []).filter(
        (c) => c.fk_model_id === tableRecord.id,
      );

      // Insert all column metadata for this table
      for (const columnRecord of tableColumns) {
        const columnToInsert = {
          ...columnRecord,
          base_id: targetContext.base_id,
          fk_model_id: insertedTableId,
        };

        await ncMeta.knex(MetaTable.COLUMNS).insert(columnToInsert);
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
        .filter((c) => !isVirtualCol(c))
        .map((c) => ({
          ...c,
          cn: c.column_name,
        }));

      const tablePayload = {
        ...tableRecord,
        tn: tableRecord.table_name,
        columns: physicalColumns,
      };

      // Only create physical table if it's not a view and has physical columns
      if (tableRecord.type === ModelTypes.TABLE && physicalColumns.length > 0) {
        await sqlMgr.sqlOpPlus(source, 'tableCreate', tablePayload);
      } else if (tableRecord.type === ModelTypes.VIEW) {
        // Handle view creation if needed
        await sqlMgr.sqlOpPlus(source, 'viewCreate', {
          ...tablePayload,
          view_name: tableRecord.table_name,
        });
      }

      // Note: Indexes will be created after all metadata is applied
    } catch (error) {
      console.error(`Failed to create table ${tableRecord.table_name}:`, error);
      throw new Error(
        `Failed to create table ${tableRecord.table_name}: ${error.message}`,
      );
    }
  }
}

async function handleStandaloneColumnAdditions(
  targetContext: NcContext,
  metaDiff: BaseMetaDiff,
  base: any,
  ncMeta: any,
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

      // Prepare column record for insertion
      const columnToInsert = {
        ...columnRecord,
        base_id: targetContext.base_id,
      };

      // Insert column metadata
      await ncMeta.knex(MetaTable.COLUMNS).insert(columnToInsert);

      // Perform SQL operation for non-virtual columns
      if (!isVirtualCol(columnRecord)) {
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
            })),
            columns: [
              ...parentTable.columns.map((c) => ({
                ...c,
                cn: c.column_name,
              })),
              {
                ...columnRecord,
                cn: columnRecord.column_name,
                altered: Altered.NEW_COLUMN,
              },
            ],
          };

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
  ncMeta: any,
) {
  const tablesToUpdate = metaDiff.update[MetaTable.MODELS] || [];

  for (const tableRecord of tablesToUpdate) {
    try {
      // Get the existing table record to compare changes
      const existingTable = await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', tableRecord.id)
        .first();

      if (!existingTable) {
        console.warn(`Table not found for update: ${tableRecord.id}`);
        continue;
      }

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

      // Update the table metadata
      const { id, ...updateData } = tableRecord;
      await ncMeta
        .knex(MetaTable.MODELS)
        .where('id', id)
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
  ncMeta: any,
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
      if (!isVirtualCol(columnRecord) && !isVirtualCol(existingColumn)) {
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

      // Update the column metadata
      const { id, ...updateData } = columnRecord;
      await ncMeta
        .knex(MetaTable.COLUMNS)
        .where('id', id)
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
  ncMeta: any,
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
          await ncMeta.knex(metaTable).where('id', record.id).delete();
        } catch (error) {
          console.warn(
            `Failed to delete ${metaTable} record ${record.id}:`,
            error,
          );
          // Continue with other deletions
        }
      }

      // Handle updates
      for (const record of toUpdate) {
        try {
          const { id, ...updateData } = record;
          await ncMeta
            .knex(metaTable)
            .where('id', id)
            .update({ ...updateData, base_id });
        } catch (error) {
          console.warn(
            `Failed to update ${metaTable} record ${record.id}:`,
            error,
          );
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
  tableRecord: any,
  tableColumns: any[],
  source: any,
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

    // Get database connection
    const dbDriver = await NcConnectionMgrv2.get(source);
    const baseModel = await Model.getBaseModelSQL(
      targetContext,
      {
        model,
        source,
        dbDriver,
      },
      ncMeta,
    );

    const indexName = `${tableRecord.table_name}_order_idx`;

    // Use raw SQL like the original TableService does
    const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
    await sqlClient.raw(`CREATE INDEX ?? ON ?? (??)`, [
      indexName,
      baseModel.getTnPath(tableRecord.table_name),
      metaOrderColumn.column_name,
    ]);
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
  tableRecord: any,
  tableColumns: any[],
  source: any,
  base: any,
  ncMeta: any,
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
          .where('fk_child_column_id', fkColumn.id)
          .orWhere('fk_parent_column_id', fkColumn.id)
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

        await sqlMgr.sqlOpPlus(source, 'indexCreate', indexArgs);
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
  columnRecord: any,
  parentTable: any,
  source: any,
  base: any,
  ncMeta: any,
) {
  try {
    // Only create foreign key constraint for UITypes.ForeignKey that are not virtual
    if (columnRecord.uidt === UITypes.ForeignKey) {
      return;
    }

    // Get the related table and column information from the column metadata
    // For foreign keys, we need to find the related LinkToAnotherRecord column
    const relatedLinkColumn = await ncMeta
      .knex(MetaTable.COLUMNS)
      .where('fk_child_column_id', columnRecord.id)
      .orWhere('fk_parent_column_id', columnRecord.id)
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
  base: any,
  ncMeta: any,
): Promise<void> {
  try {
    const tablesToAdd = metaDiff.add[MetaTable.MODELS] || [];

    for (const tableRecord of tablesToAdd) {
      try {
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
