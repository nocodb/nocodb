import { Injectable, Logger } from '@nestjs/common';
import { EventType, isMMOrMMLike, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '../types';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import Base from '~/models/Base';
import {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LookupColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';
import { TablesService } from '~/services/tables.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

@Injectable()
export class TableTrashHandler implements TrashHandler<Model> {
  resourceType = 'table';

  private logger = new Logger(TableTrashHandler.name);

  constructor(
    private readonly metaDependencyEventHandler: MetaDependencyEventHandler,
    private readonly tablesService: TablesService,
  ) {}

  // ── Trash ──────────────────────────────────────────────────

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Model>> {
    const table = await Model.getByIdOrName(ctx, { id });
    if (!table) {
      NcError.get(ctx).tableNotFound(id);
    }

    const base = await Base.getWithInfo(ctx, table.base_id);
    const source = base.sources.find((s) => s.id === table.source_id);

    // External source tables → hard-delete (no trash, can't soft-delete external schema)
    if (!source?.isMeta()) {
      await this.tablesService.tableDelete(ctx, {
        tableId: id,
        user: {} as any,
        req: {} as any,
      });
      // Return a result that won't create a trash entry (service checks entity)
      return { entity: table };
    }

    // MM junction tables can't be trashed individually
    if (table.mm) {
      NcError.get(ctx).invalidRequestBody(
        'Junction tables cannot be sent to trash',
      );
    }

    // Soft-delete the table
    await Model.softDelete(ctx, table.id, true);

    // Cascade: soft-delete all reverse LTAR columns in OTHER tables + create placeholders
    const cascadedColumns = await this.cascadeLinksOnTrash(ctx, table.id);

    // Mark dependents of cascade-deleted columns
    const dependents: Array<{ id: string; type: string }> = [];
    if (cascadedColumns?.length) {
      for (const item of cascadedColumns) {
        const col = await Column.get(ctx, {
          colId: item.id,
          includeDeleted: true,
        });
        if (col) {
          await this.markDependentsAndCollect(ctx, col, dependents);
        }
      }
    }

    // Mark dependents for ALL columns inside the trashed table
    // (other tables may have Lookups/Rollups referencing these columns)
    await this.markDependentsForTableColumns(ctx, table.id, dependents);

    // Build related_items
    const relatedItems: Record<string, any> = {};
    if (cascadedColumns?.length) {
      relatedItems.columns = cascadedColumns;
    }
    if (dependents.length) {
      relatedItems.dependents = dependents;
    }

    // Socket broadcast
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'table_delete',
        payload: table,
      },
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    return {
      entity: table,
      relatedItems: Object.keys(relatedItems).length ? relatedItems : undefined,
      meta: { tableType: table.type, tableMeta: table.meta },
    };
  }

  // ── Restore ────────────────────────────────────────────────

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    // Un-soft-delete the table
    await Model.softDelete(ctx, trashEntry.resource_id, false);

    // Restore cascaded link columns + drop placeholders
    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.columns?.length) {
      await this.restoreCascadedLinks(ctx, relatedItems.columns);
    }

    // Handle deferred restores (mutually-trashed tables)
    await this.restoreDeferredLinks(ctx, trashEntry.resource_id);

    // Clear dependent errors
    if (relatedItems?.dependents?.length) {
      await this.clearDependentErrors(ctx, relatedItems.dependents);
    }

    // Socket broadcast — use table_create so frontend adds back to sidebar
    const restoredTable = await Model.get(ctx, trashEntry.resource_id);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'table_create',
        payload: restoredTable,
      },
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    // Broadcast column_add for each related table whose columns were restored
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        const relatedModel = await Model.get(ctx, item.table_id);
        if (relatedModel) {
          await relatedModel.getColumns(ctx);
          NocoSocket.broadcastEvent(ctx, {
            event: EventType.META_EVENT,
            payload: {
              action: 'column_add',
              payload: { table: relatedModel, column: {} },
            } as Record<string, unknown>,
          } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
        }
      }
    }
  }

  // ── Permanent Delete ───────────────────────────────────────

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    // Clean up cascaded reverse columns (hard-delete from DB)
    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        await Noco.ncMeta.metaDelete(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COL_RELATIONS,
          { fk_column_id: item.id },
        );
        await Noco.ncMeta.metaDelete(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          item.id,
        );
      }
    }

    // Restore table + columns temporarily so tableDelete can run full cleanup
    await Model.softDelete(ctx, trashEntry.resource_id, false);
    await Noco.ncMeta
      .knexConnection(MetaTable.COLUMNS)
      .where({ fk_model_id: trashEntry.resource_id, deleted: true })
      .update({ deleted: false });

    // Run existing hard-delete chain
    await this.tablesService.tableDelete(ctx, {
      tableId: trashEntry.resource_id,
      user: {} as any,
      req: {} as any,
      forceDeleteRelations: true,
    });
  }

  // ── Cascade: All Reverse Links in Other Tables ─────────────

  private async cascadeLinksOnTrash(
    ctx: NcContext,
    tableId: string,
  ): Promise<CascadedColumn[]> {
    // Find all relations that point TO this table from OTHER tables
    const reverseRelations = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { condition: { fk_related_model_id: tableId } },
    );

    if (!reverseRelations.length) return [];

    const cascaded: CascadedColumn[] = [];

    for (const rel of reverseRelations) {
      const col = await Column.get(
        ctx,
        { colId: rel.fk_column_id, includeDeleted: true },
        Noco.ncMeta,
      );

      // Skip columns that belong to the trashed table itself
      if (!col || col.fk_model_id === tableId) continue;

      // Skip already deleted columns
      if (col.deleted) continue;

      // Skip if the column's table is also trashed
      const colTable = await Model.get(ctx, col.fk_model_id, true, Noco.ncMeta);
      if (!colTable || colTable.deleted) continue;

      // Soft-delete the reverse link column
      await Noco.ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: true },
        col.id,
      );
      await NocoCache.deepDel(
        ctx,
        `${CacheScope.COLUMN}:${col.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );

      // Create placeholder column
      const placeholder = await this.createPlaceholderColumn(
        ctx,
        col,
        colTable,
      );

      // Clear query caches on the affected table
      await View.clearSingleQueryCache(
        {
          ...ctx,
          workspace_id: colTable.fk_workspace_id,
          base_id: colTable.base_id,
        },
        col.fk_model_id,
        null,
        Noco.ncMeta,
      );

      if (placeholder) {
        cascaded.push({
          id: col.id,
          placeholder_id: placeholder.id,
          table_id: col.fk_model_id,
        });
      }
    }

    return cascaded;
  }

  // ── Restore Cascaded Links ─────────────────────────────────

  private async restoreCascadedLinks(
    ctx: NcContext,
    columns: CascadedColumn[],
  ) {
    for (const item of columns) {
      const colTable = await Noco.ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );

      if (colTable?.deleted) continue; // Deferred

      // Drop placeholder
      if (item.placeholder_id) {
        await this.dropPlaceholderColumn(ctx, item, colTable);
      }

      // Restore original column
      await Noco.ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        item.id,
      );
      await NocoCache.deepDel(
        ctx,
        `${CacheScope.COLUMN}:${item.table_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );

      if (colTable) {
        await View.clearSingleQueryCache(
          {
            ...ctx,
            workspace_id: colTable.fk_workspace_id,
            base_id: colTable.base_id,
          },
          item.table_id,
          null,
          Noco.ncMeta,
        );
      }
    }
  }

  /**
   * When table A is restored, check if any OTHER trashed tables had
   * link columns pointing to A that were deferred. If those tables are now live, restore those links.
   */
  private async restoreDeferredLinks(ctx: NcContext, restoredTableId: string) {
    const allTableTrash = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.TRASH,
      { condition: { resource_type: 'table' } },
    );

    for (const entry of allTableTrash) {
      if (!entry.related_items) continue;

      let relatedItems;
      try {
        relatedItems =
          typeof entry.related_items === 'object'
            ? entry.related_items
            : JSON.parse(entry.related_items);
      } catch {
        continue;
      }

      if (!relatedItems?.columns?.length) continue;

      const deferredForThisTable = relatedItems.columns.filter(
        (c: CascadedColumn) => c.table_id === restoredTableId,
      );

      if (!deferredForThisTable.length) continue;

      // Check if the entry's own table is still trashed
      const entryModel = await Noco.ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        entry.resource_id,
      );

      if (entryModel?.deleted) continue;

      // Restore deferred columns
      for (const item of deferredForThisTable) {
        if (item.placeholder_id) {
          await Noco.ncMeta.metaDelete(
            ctx.workspace_id,
            ctx.base_id,
            MetaTable.COLUMNS,
            item.placeholder_id,
          );
          await NocoCache.deepDel(
            ctx,
            `${CacheScope.COLUMN}:${item.placeholder_id}`,
            CacheDelDirection.CHILD_TO_PARENT,
          );
        }

        await Noco.ncMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: false },
          item.id,
        );
      }

      await NocoCache.deepDel(
        ctx,
        `${CacheScope.COLUMN}:${restoredTableId}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      await View.clearSingleQueryCache(ctx, restoredTableId, null, Noco.ncMeta);
    }
  }

  // ── Placeholder Column ─────────────────────────────────────

  private async createPlaceholderColumn(
    ctx: NcContext,
    originalCol: any,
    table: Model,
  ): Promise<{ id: string } | null> {
    if (!table) return null;

    const columnName = `_nc_trash_ph_${originalCol.id}`;

    const base = await Base.getWithInfo(ctx, table.base_id, false, Noco.ncMeta);
    const source = base?.sources?.find((s) => s.id === table.source_id);
    if (!source) return null;

    await table.getColumns(
      { ...ctx, workspace_id: table.fk_workspace_id, base_id: table.base_id },
      Noco.ncMeta,
    );

    try {
      const sqlMgr = await ProjectMgrv2.getSqlMgr(
        ctx,
        { id: source.base_id },
        Noco.ncMeta,
      );

      await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
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
      });
    } catch {
      return null;
    }

    const placeholderCol = await Noco.ncMeta.metaInsert2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      {
        fk_model_id: originalCol.fk_model_id,
        base_id: originalCol.base_id,
        source_id: originalCol.source_id,
        fk_workspace_id: ctx.workspace_id,
        title: originalCol.title,
        column_name: columnName,
        uidt: 'SingleLineText',
        dt: 'varchar',
        order: originalCol.order,
      },
    );

    // Populate with linked record display values (non-fatal)
    try {
      await this.populatePlaceholderValues(
        ctx,
        originalCol,
        columnName,
        table,
        source,
      );
    } catch (e) {
      this.logger.error(
        `populatePlaceholderValues failed: ${e.message}`,
        e.stack,
      );
    }

    await NocoCache.deepDel(
      ctx,
      `${CacheScope.COLUMN}:${originalCol.fk_model_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return placeholderCol;
  }

  private async dropPlaceholderColumn(
    ctx: NcContext,
    item: CascadedColumn,
    table: any,
  ) {
    const phMeta = await Noco.ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      item.placeholder_id,
    );

    if (phMeta && table) {
      try {
        const base = await Base.getWithInfo(
          ctx,
          table.base_id,
          false,
          Noco.ncMeta,
        );
        const source = base?.sources?.find((s) => s.id === table.source_id);

        if (source) {
          const tableModel = await Model.get(
            ctx,
            item.table_id,
            true,
            Noco.ncMeta,
          );
          if (tableModel) {
            await tableModel.getColumns(
              {
                ...ctx,
                workspace_id: tableModel.fk_workspace_id,
                base_id: tableModel.base_id,
              },
              Noco.ncMeta,
              undefined,
              true,
              true,
            );

            const sqlMgr = await ProjectMgrv2.getSqlMgr(
              ctx,
              { id: source.base_id },
              Noco.ncMeta,
            );

            await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
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
            });
          }
        }
      } catch {
        // Physical column drop failed — continue with meta cleanup
      }
    }

    await Noco.ncMeta.metaDelete(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      item.placeholder_id,
    );
    await NocoCache.deepDel(
      ctx,
      `${CacheScope.COLUMN}:${item.placeholder_id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
  }

  // ── Placeholder Value Population ───────────────────────────
  // Reuses the same single-query UPDATE pattern as FieldTrashHandler.
  // For table-level cascade this is called per reverse column.

  private async populatePlaceholderValues(
    ctx: NcContext,
    originalCol: any,
    placeholderColumnName: string,
    table: Model,
    source: any,
  ) {
    const colOpt = await Noco.ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { fk_column_id: originalCol.id },
    );
    if (!colOpt) return;

    const relatedTable = await Model.get(
      ctx,
      colOpt.fk_related_model_id,
      true,
      Noco.ncMeta,
    );
    if (!relatedTable) return;

    await relatedTable.getColumns(
      {
        ...ctx,
        workspace_id: relatedTable.fk_workspace_id,
        base_id: relatedTable.base_id,
      },
      Noco.ncMeta,
      undefined,
      true,
      true,
    );

    const pvCol = relatedTable.columns?.find((c) => c.pv);
    if (!pvCol) return;

    const dbDriver = await NcConnectionMgrv2.get(source);
    if (!dbDriver) return;

    const baseModel = await Model.getBaseModelSQL(ctx, {
      model: table,
      dbDriver,
      source,
    });

    const qi = baseModel.isMySQL
      ? (n: string) => `\`${n}\``
      : (n: string) => `"${n}"`;
    const qTn = (m: { table_name: string }) => {
      const schema = (baseModel as any).schema as string | undefined;
      return schema ? `${qi(schema)}.${qi(m.table_name)}` : qi(m.table_name);
    };
    const qCol = (tn: string, col: string) => `${tn}.${qi(col)}`;

    const srcTn = qTn(table);
    const relTn = qTn(relatedTable);
    const phCn = placeholderColumnName;
    const pvCn = pvCol.column_name;

    const aggFn = baseModel.isPg
      ? `string_agg(${qCol(relTn, pvCn)}::text, ', ')`
      : `GROUP_CONCAT(${qCol(relTn, pvCn)}, ', ')`;

    const isMMLike = isMMOrMMLike({ ...originalCol, colOptions: colOpt });

    if (isMMLike && colOpt.fk_mm_model_id) {
      const junctionTable = await Model.get(
        ctx,
        colOpt.fk_mm_model_id,
        true,
        Noco.ncMeta,
      );
      if (!junctionTable) return;

      const [mmChildCol, mmParentCol, childCol, parentCol] = await Promise.all([
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_mm_child_column_id,
        ),
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_mm_parent_column_id,
        ),
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!mmChildCol || !mmParentCol || !childCol || !parentCol) return;

      const jTn = qTn(junctionTable);
      const subquery = `SELECT ${qCol(
        jTn,
        mmChildCol.column_name,
      )} AS fk_val, ${aggFn} AS dv FROM ${jTn} LEFT JOIN ${relTn} ON ${qCol(
        jTn,
        mmParentCol.column_name,
      )} = ${qCol(relTn, parentCol.column_name)} WHERE ${qCol(
        relTn,
        pvCn,
      )} IS NOT NULL GROUP BY ${qCol(jTn, mmChildCol.column_name)}`;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN (${subquery}) AS _linked ON ${qCol(
            srcTn,
            childCol.column_name,
          )} = _linked.\`fk_val\` SET ${qCol(srcTn, phCn)} = _linked.\`dv\``,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
            srcTn,
            childCol.column_name,
          )} = _linked."fk_val"`,
          null,
          { raw: true },
        );
      }
    } else if (colOpt.type === 'hm') {
      const [childCol, parentCol] = await Promise.all([
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!childCol || !parentCol) return;

      const subquery = `SELECT ${qCol(
        relTn,
        childCol.column_name,
      )} AS fk_val, ${aggFn} AS dv FROM ${relTn} WHERE ${qCol(
        relTn,
        childCol.column_name,
      )} IS NOT NULL AND ${qCol(relTn, pvCn)} IS NOT NULL GROUP BY ${qCol(
        relTn,
        childCol.column_name,
      )}`;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN (${subquery}) AS _linked ON ${qCol(
            srcTn,
            parentCol.column_name,
          )} = _linked.\`fk_val\` SET ${qCol(srcTn, phCn)} = _linked.\`dv\``,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
            srcTn,
            parentCol.column_name,
          )} = _linked."fk_val"`,
          null,
          { raw: true },
        );
      }
    } else if (colOpt.type === 'bt' || colOpt.type === 'oo') {
      const [childCol, parentCol] = await Promise.all([
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        Noco.ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!childCol || !parentCol) return;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN ${relTn} ON ${qCol(
            srcTn,
            childCol.column_name,
          )} = ${qCol(relTn, parentCol.column_name)} SET ${qCol(
            srcTn,
            phCn,
          )} = ${qCol(relTn, pvCn)} WHERE ${qCol(
            srcTn,
            childCol.column_name,
          )} IS NOT NULL`,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(phCn)} = ${qCol(
            relTn,
            pvCn,
          )} FROM ${relTn} WHERE ${qCol(srcTn, childCol.column_name)} = ${qCol(
            relTn,
            parentCol.column_name,
          )} AND ${qCol(srcTn, childCol.column_name)} IS NOT NULL`,
          null,
          { raw: true },
        );
      }
    }
  }

  // ── Dependency Marking ─────────────────────────────────────

  private async markDependentsAndCollect(
    ctx: NcContext,
    col: Column,
    dependents: Array<{ id: string; type: string }>,
  ) {
    const lookups = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_LOOKUP,
      {
        xcCondition: {
          _or: [
            { fk_relation_column_id: { eq: col.id } },
            { fk_lookup_column_id: { eq: col.id } },
          ],
        },
      },
    );
    const rollups = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_ROLLUP,
      {
        xcCondition: {
          _or: [
            { fk_relation_column_id: { eq: col.id } },
            { fk_rollup_column_id: { eq: col.id } },
          ],
        },
      },
    );
    const qrCodes = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_QRCODE,
      {
        condition: { fk_qr_value_column_id: col.id },
      },
    );
    const barcodes = await Noco.ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_BARCODE,
      {
        condition: { fk_barcode_value_column_id: col.id },
      },
    );

    await this.metaDependencyEventHandler.handleEvent(ctx, {
      eventType: MetaEventType.COLUMN_DELETED,
      oldEntity: col,
    });

    for (const r of lookups)
      dependents.push({ id: r.fk_column_id, type: 'lookup' });
    for (const r of rollups)
      dependents.push({ id: r.fk_column_id, type: 'rollup' });
    for (const r of qrCodes)
      dependents.push({ id: r.fk_column_id, type: 'qrcode' });
    for (const r of barcodes)
      dependents.push({ id: r.fk_column_id, type: 'barcode' });
  }

  /**
   * Mark dependents for ALL columns inside the trashed table.
   * Other tables may have Lookups/Rollups referencing these columns.
   */
  private async markDependentsForTableColumns(
    ctx: NcContext,
    tableId: string,
    dependents: Array<{ id: string; type: string }>,
  ) {
    try {
      const columns = await Column.list(ctx, {
        fk_model_id: tableId,
        includeDeleted: true,
      });

      for (const col of columns) {
        await this.markDependentsAndCollect(ctx, col, dependents);
      }
    } catch (e) {
      this.logger.error(
        `Failed to mark dependents for table columns ${tableId}: ${e.message}`,
        e.stack,
      );
    }
  }

  private async clearDependentErrors(
    ctx: NcContext,
    dependents: Array<{ id: string; type: string }>,
  ) {
    type ErrorUpdater = (
      cx: NcContext,
      colId: string,
      data: Record<string, unknown>,
    ) => Promise<any>;

    const updaters: Record<string, ErrorUpdater> = {
      lookup: LookupColumn.update.bind(LookupColumn),
      rollup: RollupColumn.update.bind(RollupColumn),
      qrcode: QrCodeColumn.update.bind(QrCodeColumn),
      barcode: BarcodeColumn.update.bind(BarcodeColumn),
      formula: FormulaColumn.update.bind(FormulaColumn),
      button: ButtonColumn.update.bind(ButtonColumn),
    };

    for (const dep of dependents) {
      try {
        const updater = updaters[dep.type];
        if (updater) await updater(ctx, dep.id, { error: null });
      } catch (e) {
        this.logger.error(
          `Failed to clear error on dependent ${dep.id}: ${e.message}`,
          e.stack,
        );
      }
    }
  }
}
