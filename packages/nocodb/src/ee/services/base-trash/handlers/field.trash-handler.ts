import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  generateUniqueCopyName,
  isLinksOrLTAR,
  MetaEventType,
  PlanLimitTypes,
  UITypes,
  WebhookActions,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import type { MetaService } from '~/meta/meta.service';
import type { LinkToAnotherRecordColumn } from '~/models';
import BaseTrash from '~/models/BaseTrash';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { getLimit } from '~/helpers/paymentHelpers';
import { ColumnWebhookManagerBuilder } from '~/utils/column-webhook-manager';
import Base from '~/models/Base';
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
import { invalidateSingleQueryCacheForModels } from '~/helpers/metaCacheInvalidator';
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
    param: TrashCallParam,
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

    if (!table) {
      NcError.get(ctx).parentInTrash('table');
    }

    const base = await Base.getWithInfo(ctx, table.base_id, true, ncMeta);
    const source = base.sources.find((s) => s.id === table.source_id);
    if (!source?.isMeta()) {
      await this.columnsService.columnDelete(
        ctx,
        {
          columnId: id,
          req: param.req,
          skipTrash: true,
        },
        ncMeta,
      );
      return { entity: col, skipTrashEntry: true };
    }

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
    //
    // Use Noco.ncMeta (autocommit) — not the trash transaction. The DDL
    // path (sqlMgr.sqlOpPlus → ALTER TABLE) acquires a table lock, and
    // populatePlaceholderValues then runs UPDATE on a separate connection
    // pool; routing the DDL through the open meta tx would block the
    // UPDATE on PG and the file lock on SQLite. Tradeoff: if the trash
    // tx rolls back, the placeholder column is committed and orphaned.
    let cascadeResult: { columns: CascadedColumn[] } | null = null;
    if (reverseCol) {
      const result =
        await this.linkPlaceholderService.createPlaceholderForReverse(
          ctx,
          reverseCol,
          '_nc_trash_ph_',
          Noco.ncMeta,
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
    // Clear LTAR fk_display_value_column_id pointers at trash time so the
    // read paths don't try to resolve a soft-deleted display column. The same
    // cascade re-runs (no-op) at retention purge via Column.delete2.
    await Column.clearDisplayValueColumnReferences(ctx, col.id, ncMeta);
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

    // #9209: a junction-backed link (mm / V2) has auto-created system "hm"
    // link column(s) pointing at its junction model (one per related table).
    // Soft-deleting only the user-facing column leaves those system links
    // active, so the optimised single-query keeps JOINing the junction table.
    // When the junction is later removed (e.g. retention purge, or a sibling
    // link op) the cached query references a missing table and fails with
    // Postgres 42P01 ("table does not exist"). Soft-delete them alongside the
    // link; restore()/permanentDelete() reactivate them.
    //
    // Custom links are excluded: their `fk_mm_model_id` points at a real user
    // table (not an auto-junction), they have no auto-created system hm-links,
    // and their junction is never auto-dropped — so the 42P01 rationale doesn't
    // apply and scanning would wrongly soft-delete genuine user links to that
    // table (mirrors the CE delete path's `if (!custom)` guard).
    //
    // Records {id, base_id, fk_workspace_id} so restore/purge can reactivate the
    // far side in its own (possibly cross-base) context.
    const junctionSystemLinks: Array<{
      id: string;
      base_id: string;
      fk_workspace_id: string;
    }> = [];
    if (isLinksOrLTAR(col) && !col.meta?.custom) {
      const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
        ctx,
        ncMeta,
      );
      const junctionId = colOpt?.fk_mm_model_id;
      if (junctionId) {
        // Each side resolved in its own context — the related table (and so its
        // system hm-link) can live in a different base for a cross-base link.
        const { refContext } = colOpt.getRelContext(ctx);
        const sides: Array<{ table: Model | null; sideCtx: NcContext }> = [
          {
            table: await Model.get(ctx, col.fk_model_id, false, ncMeta),
            sideCtx: ctx,
          },
          {
            table: await colOpt.getRelatedTable(refContext, ncMeta),
            sideCtx: refContext,
          },
        ];
        for (const { table, sideCtx } of sides) {
          if (!table) continue;
          for (const c of await table.getColumns(sideCtx, ncMeta)) {
            if (c.id === col.id || !isLinksOrLTAR(c)) continue;
            const co = await c.getColOptions<LinkToAnotherRecordColumn>(
              sideCtx,
              ncMeta,
            );
            if (co?.fk_related_model_id === junctionId) {
              await ncMeta.metaUpdate(
                sideCtx.workspace_id,
                sideCtx.base_id,
                MetaTable.COLUMNS,
                { deleted: true },
                c.id,
              );
              await NocoCache.update(sideCtx, `${CacheScope.COLUMN}:${c.id}`, {
                deleted: true,
              });
              await invalidateSingleQueryCacheForModels(
                sideCtx,
                [c.fk_model_id],
                ncMeta,
              );
              junctionSystemLinks.push({
                id: c.id,
                base_id: sideCtx.base_id,
                fk_workspace_id: sideCtx.workspace_id,
              });
            }
          }
        }
      }
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
    if (junctionSystemLinks.length) {
      relatedItems.junctionSystemLinks = junctionSystemLinks;
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
    param: TrashCallParam,
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

    // If the field links to a trashed table, convert it to a placeholder
    // on its own table instead of restoring it. Restoring that target table
    // later will reverse the conversion — see ConvertedFieldCascade below.
    if (await this.hasDeferredCascade(ctx, trashEntry, ncMeta)) {
      await this.convertToPlaceholderOnRestore(ctx, trashEntry, ncMeta);
      return;
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
    await this.restoreCascadedLinks(ctx, trashEntry, param, ncMeta);

    const relatedItems = trashEntry.getRelatedItems();
    if (relatedItems?.dependents?.length) {
      await clearDependentErrorsIfResolved(
        ctx,
        relatedItems.dependents,
        ncMeta,
      );
    }

    // #9209: reactivate the junction system hm-link(s) soft-deleted with this
    // link, so the restored link's junction is joined again.
    await this.reactivateJunctionSystemLinks(
      ctx,
      relatedItems.junctionSystemLinks ?? [],
      ncMeta,
    );

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

    if (restoredCol) {
      await this.metaDependencyEventHandler.handleEvent(
        ctx,
        {
          eventType: MetaEventType.COLUMN_ADDED,
          newEntity: restoredCol,
        },
        ncMeta,
      );
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
          if (relatedCol) {
            await this.metaDependencyEventHandler.handleEvent(
              ctx,
              {
                eventType: MetaEventType.COLUMN_ADDED,
                newEntity: relatedCol,
              },
              ncMeta,
            );
          }
        }
      }
    }
  }

  // ── Permanent Delete ───────────────────────────────────────

  async beforePermanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<boolean> {
    await super.beforePermanentDelete(ctx, trashEntry, ncMeta);

    const existing = await Column.get(
      ctx,
      { colId: trashEntry.resource_id, includeDeleted: true },
      ncMeta,
    );
    if (!existing) {
      this.logger.log(
        `Trash entry ${trashEntry.id} field ${trashEntry.resource_id} already gone; clearing entry.`,
      );
      return false;
    }
    const parentModel = await Model.get(
      ctx,
      existing.fk_model_id,
      true,
      ncMeta,
    );
    if (!parentModel) {
      this.logger.log(
        `Trash entry ${trashEntry.id} field ${trashEntry.resource_id} parent model ${existing.fk_model_id} already gone; clearing entry.`,
      );
      return false;
    }
    return true;
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
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

    // #9209: reactivate the junction system hm-link(s) before delegating to
    // columnDelete. Its junction-cleanup loops iterate getColumns(), which
    // filters soft-deleted rows — so links left soft-deleted here would be
    // invisible to it and orphaned (their COLUMNS + COL_RELATIONS rows) once the
    // junction model/table is dropped. Reactivating makes them live so the CE
    // teardown removes them together with the junction.
    await this.reactivateJunctionSystemLinks(
      ctx,
      trashEntry.getRelatedItems().junctionSystemLinks ?? [],
      ncMeta,
    );

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
        req: param.req,
        forceDeleteSystem: true,
        skipLinkPlaceholder: true,
        skipTrash: true,
        columnWebhookManager: silentWebhookManager,
      },
      ncMeta,
    );
  }

  // ── Restore Cascaded Links ─────────────────────────────────

  /**
   * Reactivate (un-soft-delete) the junction system hm-link(s) recorded at
   * trash time, each in its own (possibly cross-base) context, and refresh the
   * affected models' single-query cache. Used on restore, deferred-restore
   * conversion, and permanent-delete (where the CE junction teardown must see
   * them as live to clean them up with the junction).
   */
  private async reactivateJunctionSystemLinks(
    ctx: NcContext,
    links: Array<{ id: string; base_id: string; fk_workspace_id: string }>,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    for (const ref of links) {
      const sideCtx = {
        ...ctx,
        workspace_id: ref.fk_workspace_id,
        base_id: ref.base_id,
      };
      await ncMeta.metaUpdate(
        ref.fk_workspace_id,
        ref.base_id,
        MetaTable.COLUMNS,
        { deleted: false },
        ref.id,
      );
      const fc = await ncMeta.metaGet2(
        ref.fk_workspace_id,
        ref.base_id,
        MetaTable.COLUMNS,
        ref.id,
      );
      if (fc) {
        await NocoCache.set(sideCtx, `${CacheScope.COLUMN}:${ref.id}`, fc);
        await invalidateSingleQueryCacheForModels(
          sideCtx,
          [fc.fk_model_id],
          ncMeta,
        );
      }
    }
  }

  private async restoreCascadedLinks(
    ctx: NcContext,
    trashEntry: BaseTrash,
    param: TrashCallParam,
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
              req: param.req,
              forceDeleteSystem: true,
              skipTrash: true,
            },
            ncMeta,
          );
        }
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

  private async hasDeferredCascade(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: MetaService,
  ): Promise<boolean> {
    const relatedItems = trashEntry.getRelatedItems();
    if (!relatedItems?.columns?.length) return false;
    for (const item of relatedItems.columns as CascadedColumn[]) {
      const colTable = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );
      if (colTable?.deleted) return true;
    }
    return false;
  }

  private async convertToPlaceholderOnRestore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta: MetaService,
  ): Promise<void> {
    const col = await Column.get(
      ctx,
      { colId: trashEntry.resource_id, includeDeleted: true },
      ncMeta,
    );
    if (!col) return;

    // #9209: this is the deferred-restore path — the field becomes a placeholder
    // and its trash entry is dropped, so its junctionSystemLinks ids would be
    // lost. Reactivate them now (the junction still exists) so they don't stay
    // soft-deleted forever and get orphaned at the eventual purge.
    await this.reactivateJunctionSystemLinks(
      ctx,
      trashEntry.getRelatedItems().junctionSystemLinks ?? [],
      ncMeta,
    );

    const parentTable = await Model.getWithInfo(
      ctx,
      {
        id: col.fk_model_id,
      },
      ncMeta,
    );
    if (!parentTable) return;

    // Create placeholder on the field's own table (snapshot of linked data).
    // Routed through Noco.ncMeta (autocommit) — see the matching note in
    // trash() above for why this must run outside the restore transaction.
    const placeholderResult =
      await this.linkPlaceholderService.createPlaceholderForReverse(
        ctx,
        col,
        '_nc_trash_ph_',
        Noco.ncMeta,
      );
    if (!placeholderResult) return;

    const fieldEntry: CascadedColumn = {
      id: col.id,
      placeholder_id: placeholderResult.placeholder.id,
      table_id: parentTable.id,
    };

    // Group existing cascade items by their (trashed) target table and
    // append — together with the new fieldEntry — onto each target's trash
    // row. When that table is restored, its restoreCascadedLinks will drop
    // the placeholder and un-soft-delete the column.
    const relatedItems = trashEntry.getRelatedItems() || {};
    const existing: CascadedColumn[] = Array.isArray(relatedItems.columns)
      ? (relatedItems.columns as CascadedColumn[])
      : [];

    const byTarget = new Map<string, CascadedColumn[]>();
    for (const item of existing) {
      const colTable = await ncMeta.metaGet2(
        ctx.workspace_id,
        ctx.base_id,
        MetaTable.MODELS,
        item.table_id,
      );
      if (!colTable?.deleted) continue;
      if (!byTarget.has(item.table_id)) byTarget.set(item.table_id, []);
      byTarget.get(item.table_id)!.push(item);
    }

    for (const [targetTableId, items] of byTarget) {
      await this.appendCascadesToTableTrash(
        ctx,
        targetTableId,
        [...items, fieldEntry],
        ncMeta,
      );
    }

    // Broadcast placeholder add on parent table
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'column_add',
        payload: {
          table: parentTable,
          column: await Column.get(
            ctx,
            { colId: placeholderResult.placeholder.id },
            ncMeta,
          ),
        },
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    await View.clearSingleQueryCache(ctx, parentTable.id, null, ncMeta);
  }

  private async appendCascadesToTableTrash(
    ctx: NcContext,
    tableId: string,
    items: CascadedColumn[],
    ncMeta: MetaService,
  ) {
    const [tableTrash] = await ncMeta.metaList2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.TRASH,
      {
        condition: { resource_type: 'table', resource_id: tableId },
        limit: 1,
      },
    );
    if (!tableTrash) return;

    let relatedItems: Record<string, any> = {};
    if (tableTrash.related_items) {
      try {
        relatedItems =
          typeof tableTrash.related_items === 'object'
            ? tableTrash.related_items
            : JSON.parse(tableTrash.related_items);
      } catch {
        relatedItems = {};
      }
    }

    const existing: CascadedColumn[] = Array.isArray(relatedItems.columns)
      ? relatedItems.columns
      : [];
    const existingIds = new Set(existing.map((c) => c.id));
    const toAdd = items.filter((i) => !existingIds.has(i.id));
    if (!toAdd.length) return;

    relatedItems.columns = [...existing, ...toAdd];

    await BaseTrash.update(
      ctx,
      tableTrash.id,
      { related_items: relatedItems as any },
      ncMeta,
    );
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
