import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  generateUniqueCopyName,
  isLinksOrLTAR,
  MetaEventType,
  NOCO_SERVICE_USERS,
  PlanLimitTypes,
  UITypes,
  WebhookActions,
} from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashResult } from '~/services/base-trash/types';
import type { MetaService } from '~/meta/meta.service';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { getLimit } from '~/helpers/paymentHelpers';
import { ColumnWebhookManagerBuilder } from '~/utils/column-webhook-manager';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import { ButtonColumn, FormulaColumn } from '~/models';
import addFormulaErrorIfMissingColumn from '~/helpers/addFormulaErrorIfMissingColumn';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { ColumnsService } from '~/services/columns.service';
import { LinkPlaceholderService } from '~/services/link-placeholder.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { clearDependentErrorsIfResolved } from '~/services/base-trash/dependent-error-helpers';
import { CacheScope, MetaTable } from '~/utils/globals';

interface CascadedColumn {
  id: string;
  placeholder_id: string;
  table_id: string;
}

@Injectable()
export class FieldTrashHandler extends BaseTrashHandler<Column> {
  resourceType = 'field';
  affectedCaches = ['baseSchema'] as const;

  private logger = new Logger(FieldTrashHandler.name);

  constructor(
    private readonly metaDependencyEventHandler: MetaDependencyEventHandler,
    private readonly columnsService: ColumnsService,
    private readonly linkPlaceholderService: LinkPlaceholderService,
  ) {
    super();
  }

  async trash(
    ctx: NcContext,
    id: string,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Column>> {
    const col = await Column.get(ctx, { colId: id }, ncMeta);
    if (!col) {
      NcError.get(ctx).fieldNotFound(id);
    }

    const table = await Model.getByIdOrName(
      ctx,
      { id: col.fk_model_id },
      ncMeta,
    );

    const columnWebhookManager = (
      await (
        await new ColumnWebhookManagerBuilder(ctx, ncMeta).withModelId(
          col.fk_model_id,
        )
      ).addColumnById(col.id)
    ).forDelete();

    // Find reverse link column before transaction (read-only)
    let reverseCol: Column | null = null;
    if (isLinksOrLTAR(col)) {
      reverseCol = await this.linkPlaceholderService.findReverseLinkColumn(
        ctx,
        col.id,
        ncMeta,
      );
    }

    // Create placeholder before soft-deleting — the placeholder's
    // display-value population may resolve a Formula pv that references
    // these link columns.  If columns are already soft-deleted,
    // formulaQueryBuilderv2 filters them out and generates invalid SQL.
    let cascadeResult: { columns: CascadedColumn[] } | null = null;
    if (reverseCol) {
      const result =
        await this.linkPlaceholderService.createPlaceholderForReverse(
          ctx,
          reverseCol,
          '_nc_trash_ph_',
          ncMeta,
        );
      if (result) {
        cascadeResult = {
          columns: [
            {
              id: result.reverseCol.id,
              placeholder_id: result.placeholder.id,
              table_id: result.table_id,
            },
          ],
        };
      }
    }
    await ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      { deleted: true },
      col.id,
    );
    await NocoCache.update(ctx, `${CacheScope.COLUMN}:${col.id}`, {
      deleted: true,
    });
    await View.clearSingleQueryCache(ctx, col.fk_model_id, null, ncMeta);

    // Soft-delete reverse link column in the same transaction
    if (reverseCol) {
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: true },
        reverseCol.id,
      );
      await NocoCache.update(ctx, `${CacheScope.COLUMN}:${reverseCol.id}`, {
        deleted: true,
      });
    }

    // Mark formula/button dependents (same table, sync)
    const dependents: Array<{ id: string; type: string }> = [];
    await this.markFormulaErrors(ctx, col, dependents, ncMeta);

    // Mark Lookup/Rollup/QrCode/Barcode dependents (async BFS)
    await this.markDependentsAndCollect(ctx, col, dependents, ncMeta);

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns || []) {
        const cascadedCol = await Column.get(
          ctx,
          {
            colId: item.id,
            includeDeleted: true,
          },
          ncMeta,
        );
        if (cascadedCol) {
          await this.markDependentsAndCollect(
            ctx,
            cascadedCol,
            dependents,
            ncMeta,
          );
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
    await table.getColumns(ctx, ncMeta);

    NocoSocket.broadcastEvent(
      ctx,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_delete',
          payload: { table, column: col },
        } as Record<string, unknown>,
      } as Parameters<typeof NocoSocket.broadcastEvent>[1],
      ctx.socket_id,
    );

    if (cascadeResult?.columns?.length) {
      for (const item of cascadeResult.columns) {
        const relatedTable = await Model.getWithInfo(
          ctx,
          {
            id: item.table_id,
          },
          ncMeta,
        );
        NocoSocket.broadcastEvent(ctx, {
          event: EventType.META_EVENT,
          payload: {
            action: 'column_delete',
            payload: { table: relatedTable },
          } as Record<string, unknown>,
        } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
      }
    }

    await columnWebhookManager.populateNewColumns();
    columnWebhookManager.emit();

    return {
      entity: col,
      relatedItems: Object.keys(relatedItems).length ? relatedItems : undefined,
      meta: { uidt: col.uidt },
      parentType: 'table',
      parentId: col.fk_model_id,
      parentName: table?.title,
    };
  }

  async checkRestoreLimit(
    ctx: NcContext,
    trashEntry: BaseTrash,
  ): Promise<void> {
    if (!trashEntry.parent_id) return;

    const current = await Noco.ncMeta.metaCount(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      {
        condition: { fk_model_id: trashEntry.parent_id },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_COLUMN_PER_TABLE,
      ctx.workspace_id,
    );

    if (limit !== Infinity && current >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} fields for your plan. Upgrade to restore this field.`,
        { plan: plan?.title, limit, current },
      );
    }
  }

  // ── Restore ────────────────────────────────────────────────

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    // Validate parent
    if (trashEntry.parent_id) {
      const parentTable = await Model.get(
        ctx,
        trashEntry.parent_id,
        true,
        ncMeta,
      );
      if (!parentTable) {
        NcError.get(ctx).tableNotFound(trashEntry.parent_id);
      }
      if (parentTable.deleted) {
        NcError.get(ctx).parentInTrash('table');
      }
    }

    const columnWebhookManager = (
      await new ColumnWebhookManagerBuilder(ctx, ncMeta).withModelId(
        trashEntry.parent_id,
      )
    ).forCreate();

    // Resolve title collision — rename restored column if a live column in the
    // same table already holds the original title. column_name is already
    // auto-uniquified at create time via getUniqueColumnName, so only title
    // needs handling here.
    let renamedTitle: string | undefined;
    if (trashEntry.name && trashEntry.parent_id) {
      const liveColumns = await Column.list(
        ctx,
        { fk_model_id: trashEntry.parent_id },
        ncMeta,
      );
      const existingTitles = liveColumns.map((c) => c.title);
      if (existingTitles.includes(trashEntry.name)) {
        renamedTitle = generateUniqueCopyName(trashEntry.name, existingTitles, {
          prefix: 'Restored',
        });
      }
    }

    // Restore column
    await ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      renamedTitle
        ? { deleted: false, title: renamedTitle }
        : { deleted: false },
      trashEntry.resource_id,
    );
    const freshCol = await ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      trashEntry.resource_id,
    );
    if (freshCol) {
      await NocoCache.set(
        ctx,
        `${CacheScope.COLUMN}:${trashEntry.resource_id}`,
        freshCol,
      );
    }
    await View.clearSingleQueryCache(ctx, trashEntry.parent_id, null, ncMeta);

    // Restore cascaded link columns + drop placeholders
    await this.restoreCascadedLinks(ctx, trashEntry, ncMeta);

    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.dependents?.length) {
      await clearDependentErrorsIfResolved(ctx, relatedItems.dependents);
    }

    // Socket broadcast — include the restored column so frontend can update
    const restoredTable = await Model.getWithInfo(
      ctx,
      { id: trashEntry.parent_id },
      ncMeta,
    );

    const restoredCol = await Column.get(
      ctx,
      { colId: trashEntry.resource_id },
      ncMeta,
    );

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_add',
        payload: { table: restoredTable, column: restoredCol },
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    if (restoredCol) {
      await columnWebhookManager.addNewColumnById({
        columnId: restoredCol.id,
        action: WebhookActions.INSERT,
      });
      columnWebhookManager.emit();
    }

    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        const relatedModel = await Model.getWithInfo(
          ctx,
          { id: item.table_id },
          ncMeta,
        );
        if (relatedModel) {
          const relatedCol = await Column.get(ctx, { colId: item.id }, ncMeta);
          NocoSocket.broadcastEvent(ctx, {
            event: EventType.META_EVENT,
            payload: {
              action: 'column_add',
              payload: { table: relatedModel, column: relatedCol },
            } as Record<string, unknown>,
          } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
        }
      }
    }
  }

  // ── Permanent Delete ───────────────────────────────────────

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const relatedItems = trashEntry.getRelatedItems();
    // Restore cascaded reverse columns temporarily so columnsService can find them
    if (relatedItems?.columns?.length) {
      for (const item of relatedItems.columns) {
        await ncMeta.metaUpdate(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          { deleted: false },
          item.id,
        );
        const freshCol = await ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          item.id,
        );
        if (freshCol) {
          await NocoCache.set(ctx, `${CacheScope.COLUMN}:${item.id}`, freshCol);
        }
      }
    }

    // Restore primary column temporarily
    await ncMeta.metaUpdate(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      { deleted: false },
      trashEntry.resource_id,
    );
    const freshCol = await ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      trashEntry.resource_id,
    );
    if (freshCol) {
      await NocoCache.set(
        ctx,
        `${CacheScope.COLUMN}:${trashEntry.resource_id}`,
        freshCol,
      );
    }

    // Pass a silent webhook manager to suppress the DELETE webhook — it was
    // already emitted at trash time, so we don't want a duplicate at retention
    // cleanup. columnDelete only emits if no manager was passed in.
    const silentWebhookManager = (
      await new ColumnWebhookManagerBuilder(ctx, ncMeta).withModelId(
        freshCol?.fk_model_id ?? trashEntry.parent_id,
      )
    ).forDelete();

    // Use columnsService for full cleanup (FK constraints, junction tables, view columns, etc.)
    await this.columnsService.columnDelete(
      ctx,
      {
        columnId: trashEntry.resource_id,
        user: NOCO_SERVICE_USERS.TRASH_CLEANUP_USER as unknown as UserType,
        forceDeleteSystem: true,
        skipLinkPlaceholder: true,
        skipTrash: true,
        columnWebhookManager: silentWebhookManager,
      },
      ncMeta,
    );
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

      // Delete placeholder column (skip if already deleted)
      if (item.placeholder_id) {
        const phCol = await Column.get(
          ctx,
          { colId: item.placeholder_id },
          ncMeta,
        );
        if (phCol) {
          await this.columnsService.columnDelete(
            ctx,
            {
              columnId: item.placeholder_id,
              user: {} as any,
              forceDeleteSystem: true,
              skipTrash: true,
            },
            ncMeta,
          );
        }
      }

      // Restore original column — update DB
      await ncMeta.metaUpdate(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        item.id,
      );
      const freshRevCol = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.COLUMNS,
        item.id,
      );
      if (freshRevCol) {
        await NocoCache.set(
          ctx,
          `${CacheScope.COLUMN}:${item.id}`,
          freshRevCol,
        );
      }

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
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const columns = await Column.list(
      ctx,
      { fk_model_id: col.fk_model_id },
      ncMeta,
    );

    for (const formulaCol of columns.filter(
      (c) => c.uidt === UITypes.Formula,
    )) {
      const formula = await formulaCol.getColOptions<FormulaColumn>(
        ctx,
        ncMeta,
      );
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
          ncMeta,
        );
        dependents.push({ id: formulaCol.id, type: 'formula' });
      }
    }

    for (const buttonCol of columns.filter((c) => c.uidt === UITypes.Button)) {
      const button = await buttonCol.getColOptions<ButtonColumn>(ctx, ncMeta);
      if (
        button?.type === 'url' &&
        button.formula &&
        addFormulaErrorIfMissingColumn({
          formula: button,
          columnId: col.id,
          title: col.title,
        })
      ) {
        await ButtonColumn.update(ctx, buttonCol.id, button as any, ncMeta);
        dependents.push({ id: buttonCol.id, type: 'button' });
      }
    }
  }

  private async markDependentsAndCollect(
    ctx: NcContext,
    col: Column,
    dependents: Array<{ id: string; type: string }>,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const lookups = await ncMeta.metaList2(
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
    const rollups = await ncMeta.metaList2(
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
    const qrCodes = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_QRCODE,
      {
        condition: { fk_qr_value_column_id: col.id },
      },
    );
    const barcodes = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_BARCODE,
      {
        condition: { fk_barcode_value_column_id: col.id },
      },
    );

    await this.metaDependencyEventHandler.handleEvent(
      ctx,
      {
        eventType: MetaEventType.COLUMN_DELETED,
        oldEntity: col,
      },
      ncMeta,
    );

    for (const r of lookups)
      dependents.push({ id: r.fk_column_id, type: 'lookup' });
    for (const r of rollups)
      dependents.push({ id: r.fk_column_id, type: 'rollup' });
    for (const r of qrCodes)
      dependents.push({ id: r.fk_column_id, type: 'qrcode' });
    for (const r of barcodes)
      dependents.push({ id: r.fk_column_id, type: 'barcode' });
  }
}
