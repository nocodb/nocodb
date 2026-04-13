import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  isLinksOrLTAR,
  isMMOrMMLike,
  MetaEventType,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '../types';
import type { MetaService } from '~/meta/meta.service';
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
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import NocoCache from '~/cache/NocoCache';
import { NcBaseError, NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

@Injectable()
export class FieldTrashHandler implements TrashHandler<Column> {
  resourceType = 'field';

  private logger = new Logger(FieldTrashHandler.name);

  constructor(
    private readonly metaDependencyEventHandler: MetaDependencyEventHandler,
  ) {}

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Column>> {
    const col = await Column.get(ctx, { colId: id });
    if (!col) {
      NcError.get(ctx).fieldNotFound(id);
    }

    const table = await Model.getByIdOrName(ctx, { id: col.fk_model_id });

    // Soft-delete column + evict cache (in transaction)
    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    try {
      await ncMeta.metaUpdate(
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
      await View.clearSingleQueryCache(ctx, col.fk_model_id, null, ncMeta);
      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error(e.message, e.stack);
      throw e;
    }

    // Link cascade (outside transaction — sqlMgr opens own connection)
    let cascadeResult: { columns: CascadedColumn[] } | null = null;
    if (isLinksOrLTAR(col)) {
      cascadeResult = await this.cascadeLinkField(ctx, col.id);
    }

    // Mark formula/button dependents (same table, sync)
    const dependents: Array<{ id: string; type: string }> = [];
    await this.markFormulaErrors(ctx, col, dependents);

    // Mark Lookup/Rollup/QrCode/Barcode dependents (async BFS)
    await this.markDependentsAndCollect(ctx, col, dependents);

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns || []) {
        const cascadedCol = await Column.get(ctx, {
          colId: item.id,
          includeDeleted: true,
        });
        if (cascadedCol) {
          await this.markDependentsAndCollect(ctx, cascadedCol, dependents);
        }
      }
    }

    // Build related_items
    const relatedItems: Record<string, any> = {};
    if (cascadeResult?.columns?.length) {
      relatedItems.columns = cascadeResult.columns;
    }
    if (dependents.length) {
      relatedItems.dependents = dependents;
    }

    // Socket broadcast
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_delete',
        payload: { table, column: col },
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns) {
        NocoSocket.broadcastEvent(ctx, {
          event: EventType.META_EVENT,
          payload: {
            action: 'column_delete',
            payload: { table: { id: item.table_id, base_id: col.base_id } },
          } as Record<string, unknown>,
        } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
      }
    }

    return {
      entity: col,
      relatedItems: Object.keys(relatedItems).length ? relatedItems : undefined,
      meta: { uidt: col.uidt },
      parentType: 'table',
      parentId: col.fk_model_id,
      parentName: table?.title,
    };
  }

  // ── Restore ────────────────────────────────────────────────

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    // Validate parent
    if (trashEntry.parent_id) {
      const parentTable = await Model.get(ctx, trashEntry.parent_id, true);
      if (!parentTable) {
        NcError.get(ctx).tableNotFound(trashEntry.parent_id);
      }
      if (parentTable.deleted) {
        NcError.get(ctx).parentInTrash('table');
      }
    }

    const ncMeta = await (Noco.ncMeta as MetaService).startTransaction();
    try {
      // Restore column
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        trashEntry.resource_id,
      );
      await NocoCache.deepDel(
        ctx,
        `${CacheScope.COLUMN}:${trashEntry.parent_id}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
      await View.clearSingleQueryCache(ctx, trashEntry.parent_id, null, ncMeta);

      // Restore cascaded link columns + drop placeholders
      await this.restoreCascadedLinks(ctx, trashEntry, ncMeta);

      await ncMeta.commit();
    } catch (e) {
      await ncMeta.rollback();
      this.logger.error(e.message, e.stack);
      throw e;
    }

    // Clear dependent errors
    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.dependents?.length) {
      await this.clearDependentErrors(ctx, relatedItems.dependents);
    }

    // Socket broadcast
    const restoredTable = await Model.get(ctx, trashEntry.parent_id);
    if (restoredTable) {
      await restoredTable.getColumns(ctx);
    }

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_add',
        payload: { table: restoredTable, column: {} },
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

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
        // Placeholder SLT stays — user keeps snapshot data
      }
    }

    // Restore temporarily + clear cache so Column.delete2 fetches fresh
    await Noco.ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      { deleted: false },
      trashEntry.resource_id,
    );
    await NocoCache.deepDel(
      ctx,
      `${CacheScope.COLUMN}:${trashEntry.resource_id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await Column.delete(ctx, trashEntry.resource_id);
  }

  // ── Link Cascade ───────────────────────────────────────────

  private async cascadeLinkField(
    ctx: NcContext,
    columnId: string,
  ): Promise<{ columns: CascadedColumn[] } | null> {
    const col = await Column.get(
      ctx,
      { colId: columnId, includeDeleted: true },
      Noco.ncMeta,
    );
    if (!col) return null;

    const colOpt = await Noco.ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { fk_column_id: columnId },
    );
    if (!colOpt) return null;

    const relatedTableId = colOpt.fk_related_model_id;
    if (!relatedTableId) return null;

    const relatedTable = await Model.get(
      ctx,
      relatedTableId,
      true,
      Noco.ncMeta,
    );
    if (!relatedTable) return null;

    // Find reverse column
    const relatedCols = await relatedTable.getColumns(
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

    let reverseCol: typeof col | null = null;

    for (const c of relatedCols) {
      if (!isLinksOrLTAR(c)) continue;
      if (c.id === columnId) continue;

      const revOpt = await c.getColOptions<any>(
        {
          ...ctx,
          workspace_id: relatedTable.fk_workspace_id,
          base_id: relatedTable.base_id,
        },
        Noco.ncMeta,
      );
      if (!revOpt) continue;

      if (this.matchReverseColumn(col, colOpt, revOpt)) {
        reverseCol = c;
        break;
      }
    }

    if (!reverseCol || reverseCol.deleted) return null;

    // Soft-delete reverse column
    await Noco.ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      { deleted: true },
      reverseCol.id,
    );
    await NocoCache.deepDel(
      ctx,
      `${CacheScope.COLUMN}:${reverseCol.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // Create placeholder column
    const revTable = await Model.get(
      ctx,
      reverseCol.fk_model_id,
      true,
      Noco.ncMeta,
    );
    const placeholder = await this.createPlaceholderColumn(
      ctx,
      reverseCol,
      revTable,
    );

    if (revTable) {
      await View.clearSingleQueryCache(
        {
          ...ctx,
          workspace_id: revTable.fk_workspace_id,
          base_id: revTable.base_id,
        },
        reverseCol.fk_model_id,
        null,
        Noco.ncMeta,
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

  private matchReverseColumn(
    originalCol: any,
    original: any,
    candidate: any,
  ): boolean {
    if (isMMOrMMLike({ ...originalCol, colOptions: original })) {
      return (
        candidate.fk_parent_column_id === original.fk_child_column_id &&
        candidate.fk_child_column_id === original.fk_parent_column_id &&
        candidate.fk_mm_model_id === original.fk_mm_model_id &&
        candidate.fk_mm_parent_column_id === original.fk_mm_child_column_id &&
        candidate.fk_mm_child_column_id === original.fk_mm_parent_column_id
      );
    }

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

    if (original.type === RelationTypes.ONE_TO_ONE) {
      return (
        candidate.type === RelationTypes.ONE_TO_ONE &&
        candidate.fk_parent_column_id === original.fk_parent_column_id &&
        candidate.fk_child_column_id === original.fk_child_column_id
      );
    }

    return false;
  }

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

    // Create physical DB column
    try {
      const sqlMgr = ProjectMgrv2.getSqlMgr(
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

    // Create meta entry
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

    // Populate with linked record display values
    try {
      await this.populatePlaceholderValues(
        ctx,
        originalCol,
        columnName,
        table,
        source,
      );
    } catch (e) {
      // Non-fatal — placeholder column exists but values couldn't be populated
      this.logger.error(
        `populatePlaceholderValues failed: ${JSON.stringify(
          Object.getOwnPropertyNames(e).reduce((o, k) => {
            o[k] = e[k];
            return o;
          }, {}),
        )}`,
      );
    }

    // Evict column list cache
    await NocoCache.deepDel(
      ctx,
      `${CacheScope.COLUMN}:${originalCol.fk_model_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return placeholderCol;
  }

  /**
   * Populate placeholder column with linked display values using a single
   * UPDATE query per link type. Uses CTE + aggregation (string_agg/GROUP_CONCAT)
   * and UPDATE...FROM (PG/SQLite) or UPDATE...JOIN (MySQL).
   */
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

    // Use BaseModelSqlv2 for proper table path quoting and query execution
    const baseModel = await Model.getBaseModelSQL(ctx, {
      model: table,
      dbDriver,
      source,
    });

    // Quote identifiers for raw SQL — PG lowercases unquoted mixed-case names
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
          `UPDATE ${srcTn} SET "${phCn}" = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
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
          `UPDATE ${srcTn} SET "${phCn}" = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
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
          `UPDATE ${srcTn} SET "${phCn}" = ${qCol(
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

  // ── Restore Cascaded Links ─────────────────────────────────

  private async restoreCascadedLinks(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: any,
  ) {
    const relatedItems = trashEntry.getRelatedItems();
    if (!relatedItems?.columns?.length) return;

    for (const item of relatedItems.columns) {
      const colTable = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );

      if (colTable?.deleted) continue; // Deferred

      // Drop placeholder
      if (item.placeholder_id) {
        const phMeta = await ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          item.placeholder_id,
        );

        if (phMeta && colTable) {
          try {
            const base = await Base.getWithInfo(ctx, colTable.base_id, ncMeta);
            const source = base?.sources?.find(
              (s) => s.id === colTable.source_id,
            );

            if (source) {
              const tableModel = await Model.get(
                ctx,
                item.table_id,
                true,
                ncMeta,
              );
              if (tableModel) {
                await tableModel.getColumns(
                  {
                    ...ctx,
                    workspace_id: tableModel.fk_workspace_id,
                    base_id: tableModel.base_id,
                  },
                  ncMeta,
                  undefined,
                  true,
                  true,
                );

                const sqlMgr = ProjectMgrv2.getSqlMgr(
                  ctx,
                  { id: source.base_id },
                  ncMeta,
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

        await ncMeta.metaDelete(
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

      // Restore original column
      await ncMeta.metaUpdate(
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
          ncMeta,
        );
      }
    }
  }

  // ── Dependency Marking ─────────────────────────────────────

  private async markFormulaErrors(
    ctx: NcContext,
    col: Column,
    dependents: Array<{ id: string; type: string }>,
  ) {
    const columns = await Column.list(ctx, { fk_model_id: col.fk_model_id });

    for (const formulaCol of columns.filter(
      (c) => c.uidt === UITypes.Formula,
    )) {
      const formula = await formulaCol.getColOptions<FormulaColumn>(ctx);
      if (
        formula?.formula &&
        addFormulaErrorIfMissingColumn({
          formula,
          columnId: col.id,
          title: col.title,
        })
      ) {
        await FormulaColumn.update(
          ctx,
          formulaCol.id,
          formula as FormulaColumn & { parsed_tree?: any },
        );
        dependents.push({ id: formulaCol.id, type: 'formula' });
      }
    }

    for (const buttonCol of columns.filter((c) => c.uidt === UITypes.Button)) {
      const button = await buttonCol.getColOptions<ButtonColumn>(ctx);
      if (
        button?.type === 'url' &&
        button.formula &&
        addFormulaErrorIfMissingColumn({
          formula: button,
          columnId: col.id,
          title: col.title,
        })
      ) {
        await ButtonColumn.update(ctx, buttonCol.id, button as any);
        dependents.push({ id: buttonCol.id, type: 'button' });
      }
    }
  }

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
