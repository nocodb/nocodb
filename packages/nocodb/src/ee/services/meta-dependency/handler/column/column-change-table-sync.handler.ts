import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import {
  MetaEventType,
  TableSyncMappingRole,
  UITypes as UITypesEnum,
} from 'nocodb-sdk';
import type { NcContext, UITypes } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import type TableSyncColumnMappingType from '~/models/TableSyncColumnMapping';
import { Model, TableSync, TableSyncColumnMapping } from '~/models';
import { REMAP_UIDTS } from '~/modules/table-sync/table-sync.helpers';
import { ColumnsService } from '~/services/columns.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';
import {
  buildSyncServiceReq,
  scheduleReactiveResync,
} from '~/services/meta-dependency/handler/table-sync-handler.helpers';

/** Reacts to source-side column changes on synced tables. Three branches:
 *
 *  - `COLUMN_DELETED` → drop dest col(s) (LTAR cascade via
 *    `removeSyncedField`). Source is gone, no replacement.
 *  - `COLUMN_UPDATED` with title-only diff → **no-op**. Id-based matching
 *    via `nc_table_sync_column_mappings.source_column_id` survives rename;
 *    the dest col keeps its original title. Matches Airtable behaviour.
 *  - `COLUMN_UPDATED` with uidt diff → propagate the new uidt to the dest
 *    via `columnsService.columnUpdate`, preserving `readonly=true`.
 *
 *  All dest cols are located by `listBySourceColumn(source_column_id)` —
 *  never by title.
 *
 *  Error isolation: handler returns immediately; the work is a detached
 *  `doWork()` promise. Failures log and die in `.catch()` — they cannot
 *  bubble up and fail the source-side column operation. */
@Injectable()
export class ColumnChangeTableSyncHandler implements MetaEventHandler {
  private logger = new Logger(ColumnChangeTableSyncHandler.name);

  triggerMetaEvents: MetaEventType[] = [
    MetaEventType.COLUMN_DELETED,
    MetaEventType.COLUMN_UPDATED,
  ];

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    @Inject(forwardRef(() => TableSyncService))
    protected readonly tableSyncService: TableSyncService,
    @Inject(forwardRef(() => ColumnsService))
    protected readonly columnsService: ColumnsService,
  ) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<AffectedDependencyResult | undefined> {
    const action = this.resolveAction(param);
    if (!action) return undefined;

    const mappings = await TableSyncColumnMapping.listBySourceColumn(
      context.workspace_id,
      context.base_id,
      action.sourceColumnId,
    );
    if (!mappings.length) return undefined;
    return { columns: [param.oldEntity ?? param.newEntity] };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
  ): Promise<void> {
    void this.doWork(context, param).catch((e) => {
      this.logger.error(
        `column → table-sync reaction failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    });
  }

  private async doWork(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<void> {
    const action = this.resolveAction(param);
    if (!action) return;

    const columnMappings = await TableSyncColumnMapping.listBySourceColumn(
      context.workspace_id,
      context.base_id,
      action.sourceColumnId,
    );
    if (!columnMappings.length) return;

    // At most one resync per affected sync.
    const seenSyncs = new Set<string>();

    for (const cm of columnMappings) {
      const destContext: NcContext = {
        workspace_id: cm.fk_workspace_id,
        base_id: cm.dest_base_id,
      };

      const sync = await TableSync.get(destContext, cm.fk_table_sync_id);
      if (!sync) continue;

      try {
        if (action.kind === 'delete') {
          await this.applyDelete(destContext, sync, cm, action.oldTitle);
        } else {
          await this.applyRetype(destContext, cm, action.newDestUidt);
        }
      } catch (e) {
        this.logger.error(
          `Reaction failed for sync=${sync.id} sourceCol=${
            action.sourceColumnId
          } (${action.kind}): ${(e as Error).message}`,
          (e as Error).stack,
        );
        continue;
      }

      if (!seenSyncs.has(sync.id)) {
        seenSyncs.add(sync.id);
        await scheduleReactiveResync(
          this.nocoJobsService,
          destContext,
          sync,
        ).catch((e) => {
          this.logger.warn(
            `resync enqueue failed for sync=${sync.id}: ${
              (e as Error).message
            }`,
          );
        });
      }
    }
  }

  /** Drop the dest col + (LTAR-only) junction + ref-counted shadow, plus
   *  strip the title from `selected_fields` if specific-fields mode.
   *
   *  Errors are not caught here — the per-mapping loop in `doWork` wraps
   *  this call, logs failures, and moves on. The guards below are pure
   *  control flow (idempotency + race avoidance), not error handling. */
  private async applyDelete(
    destContext: NcContext,
    sync: TableSync,
    cm: TableSyncColumnMappingType,
    oldTitle: string | undefined,
  ): Promise<void> {
    const destModel = await Model.get(destContext, cm.dest_table_id);
    if (!destModel) {
      // Dest table already gone — drop the dangling mapping and stop.
      await TableSyncColumnMapping.deleteById(destContext, cm.id);
      return;
    }
    await destModel.getColumns(destContext);
    const destCol = (destModel.columns ?? []).find(
      (c) => c.id === cm.dest_column_id,
    );
    if (!destCol) {
      // Dest col already removed (e.g. by the primary LTAR's cascade below).
      // Drop the stale mapping so the next reconcile doesn't trip on it.
      await TableSyncColumnMapping.deleteById(destContext, cm.id);
      return;
    }

    // Deleting a source LTAR fires COLUMN_DELETED for the primary col AND
    // its auto-generated reverse on the linked table. Each event triggers
    // its own detached doWork, so both would otherwise race against shared
    // dest entities (junction, index, shadow). The primary side owns the
    // tear-down — its `columnDelete` cascade already drops the inverse LTAR
    // (`columns.service.ts:4794`). For the reverse-side event (an LTAR col
    // that lives on a shadow, not the main mirror) we just drop the mapping
    // row and bail, so only one teardown ever runs.
    const mainMapping = (sync.mappings ?? []).find(
      (m) => m.role === TableSyncMappingRole.Main,
    );
    if (
      destCol.uidt === UITypesEnum.LinkToAnotherRecord &&
      mainMapping &&
      mainMapping.dest_table_id !== cm.dest_table_id
    ) {
      await TableSyncColumnMapping.deleteById(destContext, cm.id);
      return;
    }

    const req = buildSyncServiceReq(destContext);

    await this.tableSyncService.removeSyncedField(
      destContext,
      sync,
      destModel,
      destCol as any,
      req,
    );

    // Deleting a link on the source doesn't leave a hole — NocoDB replaces it
    // with a `_nc_ph_*` SingleLineText placeholder (carrying the comma-joined
    // display values) on the table the link was removed from, titled like the
    // deleted link. When that placeholder exists on our source, keep the field
    // synced as a plain text column instead of dropping it: re-derive via
    // `reconcileFields` (which creates the dest col AND writes its column-
    // mapping), then doWork's resync fills the values. Keeps dest ↔ source
    // parity. Works in both specific-fields and sync-all mode.
    const placeholder = oldTitle
      ? await this.findSourcePlaceholder(sync, oldTitle)
      : null;
    if (placeholder?.id) {
      // Placeholder cols inherit the deleted LTAR's per-view visibility, which
      // for links is usually `show: false` — so pass its id via includeColIds
      // to bypass reconcileFields' source-view visibility gate (same override
      // the column-add handler uses for freshly-added links).
      await this.tableSyncService.reconcileFields(destContext, sync, {
        nextSelectedFields: sync.selected_fields ?? null,
        linkViewByColumn: {},
        dropHiddenInView: false,
        includeColIds: new Set([placeholder.id]),
        req,
      });
      return;
    }

    // No placeholder replacement — strip the title from `selected_fields`
    // (title-keyed, user-facing) so the next reconcile doesn't re-add it.
    if (oldTitle && Array.isArray(sync.selected_fields)) {
      const next = sync.selected_fields.filter((t) => t !== oldTitle);
      if (next.length !== sync.selected_fields.length) {
        await TableSync.update(destContext, sync.id, {
          selected_fields: next,
        });
      }
    }
  }

  /** NocoDB replaces a deleted link column with a `_nc_ph_*` SingleLineText
   *  placeholder (carrying the comma-joined display values) on the table the
   *  link is removed from. Find that same-title placeholder on the sync's
   *  MAIN source table so the field can be kept as plain text rather than
   *  dropped. The `_nc_ph_` prefix is link-placeholder-specific, so this only
   *  matches a genuine link→placeholder replacement. Returns the column (its
   *  id feeds reconcileFields' includeColIds) or null. */
  private async findSourcePlaceholder(
    sync: TableSync,
    title: string,
  ): Promise<{ id?: string } | null> {
    const mainMapping = (sync.mappings ?? []).find(
      (m) => m.role === TableSyncMappingRole.Main,
    );
    if (!mainMapping) return null;

    const sourceCtx: NcContext = {
      workspace_id: mainMapping.source_workspace_id,
      base_id: mainMapping.source_base_id,
    };
    const srcModel = await Model.getWithInfo(sourceCtx, {
      id: mainMapping.source_table_id,
    });
    if (!srcModel) return null;
    await srcModel.getColumns(sourceCtx);

    return (
      (srcModel.columns ?? []).find(
        (c) =>
          c.title === title &&
          c.uidt === UITypesEnum.SingleLineText &&
          (c.column_name?.startsWith('_nc_ph_') ?? false),
      ) ?? null
    );
  }

  /** Propagate a source uidt change. Uses the same `REMAP_UIDTS` rules
   *  as create-time, so a source Formula → Number still becomes
   *  SingleLineText on dest (formula values are stored as text snapshot). */
  private async applyRetype(
    destContext: NcContext,
    cm: TableSyncColumnMappingType,
    newDestUidt: UITypes,
  ): Promise<void> {
    const destModel = await Model.get(destContext, cm.dest_table_id);
    if (!destModel) return;
    await destModel.getColumns(destContext);
    const destCol = (destModel.columns ?? []).find(
      (c) => c.id === cm.dest_column_id,
    );
    if (!destCol?.id) return;
    if (destCol.uidt === newDestUidt) return;

    const req = buildSyncServiceReq(destContext);
    await this.columnsService.columnUpdate(
      { ...destContext, socket_id: null },
      {
        columnId: destCol.id,
        column: {
          ...(destCol as any),
          uidt: newDestUidt,
          readonly: true,
        },
        user: req.user,
        req,
        bypassSyncedFieldGuard: true,
      } as any,
    );
  }

  /** Returns the action to take for this event, or null for no-ops:
   *  - `COLUMN_DELETED` → delete
   *  - `COLUMN_UPDATED` with uidt change → retype
   *  - `COLUMN_UPDATED` with title-only diff → null (id matching covers it) */
  private resolveAction(
    param: MetaDependencyEventRequest,
  ):
    | { kind: 'delete'; sourceColumnId: string; oldTitle: string | undefined }
    | { kind: 'retype'; sourceColumnId: string; newDestUidt: UITypes }
    | null {
    if (param.eventType === MetaEventType.COLUMN_DELETED) {
      const id = param.oldEntity?.id;
      if (!id) return null;
      return {
        kind: 'delete',
        sourceColumnId: id,
        oldTitle: param.oldEntity?.title,
      };
    }
    if (param.eventType === MetaEventType.COLUMN_UPDATED) {
      const oldEntity = param.oldEntity;
      const newEntity = param.newEntity;
      if (!oldEntity?.id || !newEntity?.uidt) return null;
      if (oldEntity.uidt === newEntity.uidt) return null;
      const newDestUidt = (REMAP_UIDTS[newEntity.uidt as UITypes] ??
        newEntity.uidt) as UITypes;
      return {
        kind: 'retype',
        sourceColumnId: oldEntity.id,
        newDestUidt,
      };
    }
    return null;
  }
}
