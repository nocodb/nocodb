import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  isCrossBaseLink,
  isCustomLink,
  isLinksOrLTAR,
  isSystemColumn,
  NcApiVersion,
  NcContext,
  OperationSource,
  PlanFeatureTypes,
  RelationTypes,
  SyncMappingStatus,
  TableSyncInputMode,
  TableSyncMappingRole,
  TableSyncOnDeleteAction,
  TableSyncStatus,
  TableSyncTrigger,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { syncSystemFields } from '@noco-local-integrations/core';
import type { ColumnType, NcRequest, TableSyncCreateReqType } from 'nocodb-sdk';
import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';
import {
  Base,
  Column,
  Model,
  TableSync,
  TableSyncColumnMapping,
  TableSyncMapping,
  View,
} from '~/models';
import { TraceCommand, Untraced } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { isReplay } from '~/helpers/replayScope';
import { NcError } from '~/helpers/ncError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { validatePayload } from '~/helpers';
import { extractProps } from '~/helpers/extractProps';
import {
  extractShareUuid,
  SYSTEM_REMOTE_TITLES,
  toDestColumnDef,
} from '~/modules/table-sync/table-sync.helpers';
import { toUserFacingSyncError } from '~/modules/table-sync/table-sync-error.helper';
import { getMMColumnNames, sanitizeColumnName } from '~/helpers/columnHelpers';
import { getJunctionTableName } from '~/services/columns.service';
import NocoSocket from '~/socket/NocoSocket';

const SKIP_UIDTS: ReadonlySet<string> = new Set([
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.Button,
  UITypes.Count,
  UITypes.ID,
]);

interface TableSyncMappingSnapshot {
  tableMappings: Array<{
    id: string;
    fk_table_sync_id?: string;
    source_workspace_id?: string | null;
    source_base_id?: string | null;
    source_table_id?: string | null;
    source_view_id?: string | null;
    source_uuid?: string | null;
    source_password_hash?: string | null;
    dest_base_id?: string | null;
    dest_table_id?: string | null;
    role?: string | null;
    status?: string | null;
  }>;
  columnMappings: Array<{
    fk_table_sync_id?: string | null;
    fk_table_sync_mapping_id?: string | null;
    source_workspace_id?: string | null;
    source_base_id?: string | null;
    source_table_id?: string | null;
    source_column_id?: string | null;
    dest_base_id?: string | null;
    dest_table_id?: string | null;
    dest_column_id?: string | null;
  }>;
}

@Injectable()
export class TableSyncService {
  private logger = new Logger(TableSyncService.name);

  constructor(
    protected readonly tablesService: TablesService,
    protected readonly columnsService: ColumnsService,
    protected readonly viewColumnsService: ViewColumnsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly baseTrashService: BaseTrashService,
  ) {}

  async get(
    context: NcContext,
    params: { syncId: string },
  ): Promise<TableSync | null> {
    return TableSync.get(context, params.syncId);
  }

  async list(context: NcContext): Promise<TableSync[]> {
    return TableSync.list(context);
  }

  /**
   * Read a source table's columns + views + the bound view's visible-column
   * ids, given a context already pointed at the source base. The caller is
   * responsible for authorization — both callers reach here through the share
   * view (sync mapping for edit, resolved share UUID for create), NOT the
   * caller's base ACL, so the importing user never needs source-base access.
   */
  private async buildSourceSchema(
    sourceCtx: NcContext,
    tableId: string,
    viewId: string,
  ): Promise<{
    source_table_missing: boolean;
    columns: Column[];
    views: View[];
    visible_source_column_ids: string[];
  }> {
    const empty = {
      source_table_missing: false,
      columns: [] as Column[],
      views: [] as View[],
      visible_source_column_ids: [] as string[],
    };

    const sourceTable = await Model.getWithInfo(sourceCtx, { id: tableId });

    if (!sourceTable) return { ...empty, source_table_missing: true };

    // getWithInfo already populated columns + views; just mask any share-view
    // password hashes before returning them.
    const views = (sourceTable.views ?? []).map((v) =>
      View.maskPasswordForResponse(v),
    );

    const sourceView = await View.get(sourceCtx, viewId);
    let visibleSourceColumnIds: string[] = [];
    if (sourceView) {
      const viewColumns = await View.getColumns(sourceCtx, sourceView.id);
      visibleSourceColumnIds = viewColumns
        .filter((c) => c.show)
        .map((c) => c.fk_column_id)
        .filter((id): id is string => !!id);
    }

    return {
      source_table_missing: false,
      columns: sourceTable.columns ?? [],
      views,
      visible_source_column_ids: visibleSourceColumnIds,
    };
  }

  async getSourceSchema(
    context: NcContext,
    params: { syncId: string },
  ): Promise<{
    source_table_missing: boolean;
    columns: Column[];
    views: View[];
    visible_source_column_ids: string[];
  }> {
    const empty = {
      source_table_missing: false,
      columns: [] as Column[],
      views: [] as View[],
      visible_source_column_ids: [] as string[],
    };

    const sync = await TableSync.get(context, params.syncId);
    if (!sync) NcError.get(context).tableSyncNotFound(params.syncId);

    const mainMapping = (sync.mappings ?? []).find(
      (m) => m.role === TableSyncMappingRole.Main,
    );

    if (!mainMapping) return empty;

    const sourceCtx: NcContext = {
      workspace_id: mainMapping.source_workspace_id,
      base_id: mainMapping.source_base_id,
    };

    return this.buildSourceSchema(
      sourceCtx,
      mainMapping.source_table_id,
      mainMapping.source_view_id,
    );
  }

  @TraceCommand(OperationName.tableSyncUpdate)
  async updateSync(
    context: NcContext,
    params: {
      syncId: string;
      body: Partial<{
        title: string;
        sync_trigger: TableSyncTrigger;
        on_delete_action: TableSyncOnDeleteAction;
        source_view_id: string;
        password: string;
        selected_fields: string[] | null;
        link_view_by_column: Record<string, string>;
      }>;
      req: NcRequest;
    },
  ): Promise<TableSync> {
    const { syncId: id, body: patch, req } = params;
    validatePayload(
      'swagger.json#/components/schemas/TableSyncUpdateReq',
      patch,
    );

    let oldSync = await TableSync.get(context, id);

    if (!oldSync) NcError.get(context).tableSyncNotFound(id);

    const oldMappingSet = await this.snapshotMappingSet(context, id);

    // Switching to real-time (automatic) sync requires the higher-tier feature.
    if (patch.sync_trigger === TableSyncTrigger.Realtime) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO);
    }

    if (patch.title !== undefined && patch.title !== oldSync.title) {
      await this.assertUniqueTitle(context, patch.title, id);
    }

    const mainMappingBefore = (oldSync.mappings ?? []).find(
      (m) => m.role === TableSyncMappingRole.Main,
    );
    const sourceViewChanged =
      patch.source_view_id !== undefined &&
      !!mainMappingBefore &&
      patch.source_view_id !== mainMappingBefore.source_view_id;

    if (sourceViewChanged && mainMappingBefore) {
      // Re-bind the sync to a different source view. The new view must
      // live on the same source table (the dest schema is structurally
      // bound — swapping tables would orphan every column), be a Grid
      // view with `allow_sync = true` and a non-null `uuid`, and supply
      // the share password if paste-mode and the view is protected.
      //
      // Combining the `mainMappingBefore` truthy check into the `if` (vs.
      // relying on `sourceViewChanged`'s internal `!!mainMappingBefore`)
      // lets TS narrow it through the whole block — no `!` assertions.
      const newSourceViewId = patch.source_view_id!;
      const sourceCtx: NcContext = {
        workspace_id: mainMappingBefore.source_workspace_id,
        base_id: mainMappingBefore.source_base_id,
      };
      const newView = await View.get(sourceCtx, newSourceViewId);
      if (!newView) {
        NcError.get(sourceCtx).viewNotFound(newSourceViewId);
      }
      if (newView.fk_model_id !== mainMappingBefore.source_table_id) {
        NcError.get(sourceCtx).invalidRequestBody(
          'New source view must live on the same source table as the existing sync',
        );
      }
      if (newView.type !== ViewTypes.GRID) {
        NcError.get(sourceCtx).invalidRequestBody(
          `View "${newView.title || newSourceViewId}" is not a Grid view`,
        );
      }
      if (!newView.allow_sync) {
        NcError.get(sourceCtx).forbidden(
          `Sync is not enabled on the source view "${
            newView.title || newSourceViewId
          }". Enable "Allow sync" on the view to use it as a sync source.`,
        );
      }
      if (!newView.uuid) {
        NcError.get(sourceCtx).forbidden(
          `View "${newView.title || newSourceViewId}" is not publicly shared`,
        );
      }
      // Share-link password is the sole authorization only for paste-mode
      // syncs — browse-mode is authorized by workspace ACL and the user
      // never sees the share password. The stored hash is refreshed below
      // either way so the processor's "share rotated" check keeps working.
      if (
        newView.password &&
        oldSync.source_input_mode === TableSyncInputMode.Paste
      ) {
        const ok = await View.verifyPassword(newView, patch.password ?? '');
        if (!ok) {
          NcError.get(sourceCtx).forbidden(
            'Incorrect password for the new source view',
          );
        }
      }

      await TableSyncMapping.update(context, mainMappingBefore.id, {
        source_view_id: newView.id,
        source_uuid: newView.uuid,
        source_password_hash: newView.password ?? null,
      });

      // Reload mappings — the Main mapping now points at the new view.
      oldSync = (await TableSync.get(context, id))!;
    }

    // Field-set diff is the only path that adds/drops destination columns.
    // Run it before the metadata update so a failure mid-diff leaves the row
    // pointing at its prior selected_fields.
    const fieldsTouched =
      patch.selected_fields !== undefined ||
      patch.link_view_by_column !== undefined ||
      sourceViewChanged;

    let fieldsChanged: { added: boolean; removed: boolean } = {
      added: false,
      removed: false,
    };

    if (fieldsTouched) {
      fieldsChanged = await this.reconcileFields(context, oldSync, {
        nextSelectedFields:
          patch.selected_fields !== undefined
            ? patch.selected_fields
            : oldSync.selected_fields ?? null,
        linkViewByColumn: patch.link_view_by_column ?? {},
        dropHiddenInView: sourceViewChanged,
        req,
      });
    }

    // Field-set changes trigger a full resync: additions need backfill for
    // historical rows (realtime webhooks only populate future source changes),
    // and removals need a clean pass so the dest matches the new selection
    // (covers re-derivation of any cross-field state — e.g. links/junctions —
    // and gives the user immediate confirmation that their edit was applied).
    // A view re-bind also implies a full resync — the new view may expose a
    // different filter/sort/row set even when no columns moved.
    const needsResync =
      fieldsChanged.added || fieldsChanged.removed || sourceViewChanged;

    await this.tableSyncConfigUpdate(context, {
      syncId: id,
      payload: {
        ...extractProps(patch, ['title', 'sync_trigger', 'on_delete_action']),
        ...(patch.selected_fields !== undefined
          ? { selected_fields: patch.selected_fields }
          : {}),
        ...(needsResync
          ? {
              mappings: await this.snapshotMappingSet(context, id),
              prevMappings: oldMappingSet,
            }
          : {}),
      },
      req,
    });

    let sync: TableSync;
    if (needsResync) {
      await TableSync.update(context, id, { status: TableSyncStatus.Syncing });
      sync = await this.enqueueJobOrRevert(context, id, {
        mode: 'full-resync',
        req,
      });
    } else {
      sync = (await TableSync.get(context, id))!;
    }

    this.appHooksService.emit(AppEvents.TABLE_SYNC_UPDATE, {
      context,
      req,
      sync,
      oldSync,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...sync, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return sync;
  }

  // Glue child of the `tableSyncUpdate` macro. The original forward call (not a
  // replay) just persists the scalar config fields — reconcileFields already
  // built the correct mapping set, so it skips the rebuild. On undo/redo replay
  // it ALSO rebuilds the sync's mapping rows from the supplied snapshot: the
  // macro restores dropped columns/tables from trash with their ids intact, but
  // TableSyncMapping / TableSyncColumnMapping rows aren't part of that trash
  // cycle, so they must be re-materialised here.
  @TraceCommand(OperationName.tableSyncConfigUpdate)
  async tableSyncConfigUpdate(
    context: NcContext,
    param: {
      syncId: string;
      payload: {
        title?: string;
        sync_trigger?: TableSyncTrigger;
        on_delete_action?: TableSyncOnDeleteAction;
        selected_fields?: string[] | null;
        mappings?: TableSyncMappingSnapshot;
        prevMappings?: TableSyncMappingSnapshot;
      };
      req: NcRequest;
    },
  ): Promise<TableSync> {
    const { syncId, payload, req } = param;
    const sync = await TableSync.get(context, syncId);
    if (!sync) NcError.get(context).tableSyncNotFound(syncId);

    // Build the scalar patch explicitly — `extractProps(payload, ...)` widens to
    // `Partial<payload>`, which would leak the `mappings`/`prevMappings` keys
    // into the `TableSync.update` arg (they aren't TableSync columns).
    const { title, sync_trigger, on_delete_action, selected_fields } = payload;
    await TableSync.update(context, syncId, {
      ...(title !== undefined ? { title } : {}),
      ...(sync_trigger !== undefined ? { sync_trigger } : {}),
      ...(on_delete_action !== undefined ? { on_delete_action } : {}),
      ...(selected_fields !== undefined ? { selected_fields } : {}),
      updated_by: req.user?.id,
    });

    // Only on replay — the original forward leaves the set reconcileFields
    // already produced.
    if (isReplay() && payload.mappings) {
      await this.replaceMappingSet(context, syncId, payload.mappings);

      await TableSync.update(context, syncId, {
        status: TableSyncStatus.Syncing,
      });

      await this.enqueueJobOrRevert(context, syncId, {
        mode: 'full-resync',
        req,
      });
    }

    const updated = (await TableSync.get(context, syncId))!;

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return updated;
  }

  /** Capture the sync's full mapping set (table mappings + their column
   *  mappings) so `tableSyncConfigUpdate` can rebuild it on undo/redo. */
  private async snapshotMappingSet(
    context: NcContext,
    syncId: string,
  ): Promise<TableSyncMappingSnapshot> {
    const tableMappings = await TableSyncMapping.listBySyncId(context, syncId);
    const columnMappings: TableSyncColumnMapping[] = [];
    for (const tm of tableMappings) {
      columnMappings.push(
        ...(await TableSyncColumnMapping.listByTableSyncMapping(
          context,
          tm.id,
        )),
      );
    }
    return {
      tableMappings: tableMappings.map((m) => ({
        id: m.id,
        fk_table_sync_id: m.fk_table_sync_id,
        source_workspace_id: m.source_workspace_id,
        source_base_id: m.source_base_id,
        source_table_id: m.source_table_id,
        source_view_id: m.source_view_id,
        source_uuid: m.source_uuid,
        source_password_hash: m.source_password_hash,
        dest_base_id: m.dest_base_id,
        dest_table_id: m.dest_table_id,
        role: m.role,
        status: m.status,
      })),
      columnMappings: columnMappings.map((c) => ({
        fk_table_sync_id: c.fk_table_sync_id,
        fk_table_sync_mapping_id: c.fk_table_sync_mapping_id,
        source_workspace_id: c.source_workspace_id,
        source_base_id: c.source_base_id,
        source_table_id: c.source_table_id,
        source_column_id: c.source_column_id,
        dest_base_id: c.dest_base_id,
        dest_table_id: c.dest_table_id,
        dest_column_id: c.dest_column_id,
      })),
    };
  }

  /** Tear down the sync's current mapping rows and rebuild them from `snapshot`.
   *  Column mappings drop first (they reference table mappings); table mappings
   *  re-insert with fresh ids, and each column mapping's parent reference is
   *  remapped onto the freshly-inserted table mapping. Replay-only. */
  private async replaceMappingSet(
    context: NcContext,
    syncId: string,
    snapshot: TableSyncMappingSnapshot,
  ): Promise<void> {
    await TableSyncColumnMapping.deleteBySyncId(context, syncId);
    await TableSyncMapping.deleteBySyncId(context, syncId);

    const idMap = new Map<string, string>();
    for (const tm of snapshot.tableMappings) {
      const inserted = await TableSyncMapping.insert(context, {
        fk_table_sync_id: syncId,
        source_workspace_id: tm.source_workspace_id ?? undefined,
        source_base_id: tm.source_base_id ?? undefined,
        source_table_id: tm.source_table_id ?? undefined,
        source_view_id: tm.source_view_id ?? undefined,
        source_uuid: tm.source_uuid ?? undefined,
        source_password_hash: tm.source_password_hash ?? undefined,
        dest_base_id: tm.dest_base_id ?? undefined,
        dest_table_id: tm.dest_table_id ?? undefined,
        role: (tm.role ?? undefined) as TableSyncMappingRole | undefined,
      });
      idMap.set(tm.id, inserted.id);
      if (tm.status && tm.status !== SyncMappingStatus.Active) {
        await TableSyncMapping.markStatus(
          context,
          inserted.id,
          tm.status as SyncMappingStatus,
        );
      }
    }

    for (const cm of snapshot.columnMappings) {
      const parentId = cm.fk_table_sync_mapping_id
        ? idMap.get(cm.fk_table_sync_mapping_id)
        : undefined;
      if (!parentId) continue;
      await TableSyncColumnMapping.insert(context, {
        fk_table_sync_id: syncId,
        fk_table_sync_mapping_id: parentId,
        source_workspace_id: cm.source_workspace_id ?? undefined,
        source_base_id: cm.source_base_id ?? undefined,
        source_table_id: cm.source_table_id ?? undefined,
        source_column_id: cm.source_column_id ?? undefined,
        dest_base_id: cm.dest_base_id ?? undefined,
        dest_table_id: cm.dest_table_id ?? undefined,
        dest_column_id: cm.dest_column_id ?? undefined,
      });
    }
  }

  /** Reconcile the destination column set against the source view's
   *  currently-visible columns and a target `selected_fields` list. Used
   *  by `updateSync` (when the user changes the selection or re-binds the
   *  source view) and by the column-add meta-dep handler (when a new
   *  source column appears on a sync-all sync). Returns whether anything
   *  was added or removed so callers can decide if a full resync is
   *  needed. Idempotent — safe to call when nothing has changed.
   *
   *  Public on purpose: meta-dep handlers live outside this module and
   *  need a stable seam into this logic. Callers must have already
   *  filtered for the modes they care about (the function doesn't gate
   *  by selected_fields shape itself). */
  async reconcileFields(
    context: NcContext,
    oldSync: TableSync,
    patch: {
      nextSelectedFields: string[] | null;
      linkViewByColumn: Record<string, string>;
      dropHiddenInView?: boolean;
      /** Source col ids that should be considered "visible in the source
       *  view" even if they aren't actually shown there. The column-add
       *  handler passes the just-added col here — LTAR/Links cols default
       *  to `show: false` in shared views, so without this override a new
       *  LTAR would never auto-mirror in sync-all mode. */
      includeColIds?: Set<string>;
      req: NcRequest;
    },
  ): Promise<{ added: boolean; removed: boolean }> {
    const mappings = oldSync.mappings ?? [];
    const mainMapping = mappings.find(
      (m) => m.role === TableSyncMappingRole.Main,
    );
    if (!mainMapping) {
      NcError.get(context).internalServerError(
        'Sync is missing its Main mapping; cannot diff fields',
      );
    }

    const sourceCtx: NcContext = {
      workspace_id: mainMapping.source_workspace_id,
      base_id: mainMapping.source_base_id,
    };
    const sourceTable = await Model.getWithInfo(sourceCtx, {
      id: mainMapping.source_table_id,
    });
    if (!sourceTable) {
      NcError.get(sourceCtx).tableNotFound(mainMapping.source_table_id);
    }

    const sourceView = await View.get(sourceCtx, mainMapping.source_view_id);
    if (!sourceView) {
      NcError.get(sourceCtx).viewNotFound(mainMapping.source_view_id);
    }

    const sourceViewColumns = await View.getColumns(sourceCtx, sourceView.id);
    const visibleSourceColIds = new Set<string>(
      sourceViewColumns.filter((c) => c.show).map((c) => c.fk_column_id),
    );

    const mainDest = await Model.get(context, mainMapping.dest_table_id);
    if (!mainDest) {
      NcError.get(context).invalidRequestBody(
        "This sync's destination table is missing. Restore it from the Trash to re-link the sync, or delete and recreate the sync.",
      );
    }
    await mainDest.getColumns(context);

    const newSet =
      patch.nextSelectedFields === null
        ? null
        : new Set(patch.nextSelectedFields);

    const destColsById = new Map<string, Column>(
      (mainDest.columns ?? [])
        .filter((c) => !!c.id)
        .map((c) => [c.id as string, c as Column]),
    );
    const destColsByTitle = new Map<string, Column>(
      (mainDest.columns ?? [])
        .filter((c) => !!c.title)
        .map((c) => [c.title as string, c as Column]),
    );

    // Id-keyed lookup of "already-synced" — source col id → dest col.
    // Replaces the legacy title-based `destColsByTitle.has(col.title)`
    // check so a source-side rename doesn't masquerade as a new field.
    const existingColumnMappings =
      await TableSyncColumnMapping.listByTableSyncMapping(
        context,
        mainMapping.id,
      );
    const destBySourceColId = new Map<string, Column>();
    for (const cm of existingColumnMappings) {
      const dc = destColsById.get(cm.dest_column_id);
      if (dc) destBySourceColId.set(cm.source_column_id, dc);
    }

    let anyAdded = false;
    let anyRemoved = false;

    // Dest col ids the main loop has already deleted. `dropHiddenInView`
    // below walks a snapshot of `destColsByTitle` taken before the loop ran
    // and would otherwise try to delete them again — e.g. when a source
    // column was renamed externally, the dest col's stored title no longer
    // matches its source col's current title, so the two phases match by
    // different keys (id vs. title) and both target the same row.
    const removedDestColIds = new Set<string>();

    for (const col of sourceTable.columns ?? []) {
      if (col.system || !col.title || !col.uidt) continue;
      if (SYSTEM_REMOTE_TITLES.has(col.title)) continue;
      if (SKIP_UIDTS.has(col.uidt)) continue;
      if (!col.id) continue;
      if (
        !visibleSourceColIds.has(col.id) &&
        !patch.includeColIds?.has(col.id)
      ) {
        continue;
      }
      if (isLinksOrLTAR(col) && (isCrossBaseLink(col) || isCustomLink(col))) {
        continue;
      }

      const existingByMapping = destBySourceColId.get(col.id);
      const wasIn = !!existingByMapping;
      // "Will include" uses the source col's CURRENT title for selection
      // matching — `selected_fields` is title-keyed (user-facing), so a
      // post-rename source title is what the user would have typed.
      const willIn = col.pv ? true : newSet === null || newSet.has(col.title);

      if (wasIn && willIn) {
        // Already-synced field — id matches. Check for LTAR placeholder ↔
        // proper transitions driven by `link_view_by_column` edits.
        const existingDest = existingByMapping!;
        if (col.uidt === UITypes.LinkToAnotherRecord && existingDest.id) {
          const userPick = patch.linkViewByColumn[col.title];
          const isCurrentlyProper =
            existingDest.uidt === UITypes.LinkToAnotherRecord;
          const intendedProper = !!userPick;
          if (isCurrentlyProper !== intendedProper) {
            await this.removeSyncedField(
              context,
              oldSync,
              mainDest as Model,
              existingDest,
              patch.req,
            );
            if (existingDest.id) removedDestColIds.add(existingDest.id);
            await this.addSyncedField(
              context,
              sourceCtx,
              oldSync,
              mainDest as Model,
              sourceTable as Model,
              col,
              patch.linkViewByColumn,
              patch.req,
            );
            anyAdded = true;
            anyRemoved = true;
          }
        }
        continue;
      }

      if (!wasIn && !willIn) continue;

      if (willIn) {
        // Collision policy: when ANY column already
        // occupies the source title OR column_name slot on the dest, keep it
        // and still sync the new source field under a unique alternate title
        // ("Foo" → "Foo 2"). Source/dest stay id-linked via the
        // column-mapping row so subsequent source-side renames flow through.
        //
        // We rename on every collision (user-created OR a stale synced col
        // whose source-side rename left the title slot occupied) — a non-
        // renaming codepath here was producing "duplicate column alias"
        // failures on Save in some sync configurations.
        const candidate = {
          title: col.title,
          column_name: col.column_name ?? sanitizeColumnName(col.title),
        };
        const resolved = this.resolveUniqueDestColumnName(
          mainDest.columns ?? [],
          candidate,
        );
        const destOverride =
          resolved.title !== candidate.title ||
          resolved.column_name !== candidate.column_name
            ? resolved
            : undefined;

        await this.addSyncedField(
          context,
          sourceCtx,
          oldSync,
          mainDest as Model,
          sourceTable as Model,
          col,
          patch.linkViewByColumn,
          patch.req,
          destOverride,
        );

        // Pair source → dest in nc_table_sync_column_mappings inline, before
        // returning control. Without this, the post-loop
        // `writeColumnMappingsForTableMapping` is the only writer for the
        // mapping row — leaving a window between `addSyncedField` (dest col
        // becomes visible in metadata) and the post-loop helper (mapping row
        // written). An observer racing into that window — e.g. an explicit
        // `tableSyncResync` fired right after a detached column-change
        // handler reaches the new col — sees the dest col but no mapping,
        // skips backfilling its values, and leaves the dest col empty until
        // the next resync. Idempotent vs. the post-loop helper (each
        // dest-col mapping is uniqueness-checked there too).
        if (col.id) {
          await mainDest.getColumns(context);
          const destTitle = destOverride?.title ?? col.title;
          const newDestCol = (mainDest.columns ?? []).find(
            (c) => c.title === destTitle,
          );
          if (newDestCol?.id) {
            const existing = await TableSyncColumnMapping.getByDestColumn(
              context,
              newDestCol.id,
            );
            if (!existing) {
              await TableSyncColumnMapping.insert(context, {
                fk_table_sync_id: oldSync.id,
                fk_table_sync_mapping_id: mainMapping.id,
                source_workspace_id: mainMapping.source_workspace_id,
                source_base_id: mainMapping.source_base_id,
                source_table_id: mainMapping.source_table_id,
                source_column_id: col.id,
                dest_base_id: mainMapping.dest_base_id,
                dest_table_id: mainMapping.dest_table_id,
                dest_column_id: newDestCol.id,
              });
            }
          }
        }

        anyAdded = true;
      } else {
        // Drop the dest col we previously synced for this source col id.
        const destCol = existingByMapping;
        if (!destCol) continue;
        await this.removeSyncedField(
          context,
          oldSync,
          mainDest as Model,
          destCol,
          patch.req,
        );
        if (destCol.id) removedDestColIds.add(destCol.id);
        anyRemoved = true;
      }
    }

    // When the source view was just swapped, columns that exist on the
    // destination but have no visible source col in the NEW view need to
    // be cleaned up — the loop above skips invisible source cols, so it
    // would otherwise leave them as orphan dest columns that future syncs
    // can't populate.
    if (patch.dropHiddenInView) {
      const sourceColByTitle = new Map<string, ColumnType>(
        (sourceTable.columns ?? [])
          .filter((c) => !!c.title)
          .map((c) => [c.title as string, c]),
      );
      for (const [destTitle, destCol] of destColsByTitle.entries()) {
        if (SYSTEM_REMOTE_TITLES.has(destTitle)) continue;
        if (isSystemColumn(destCol)) continue;
        // Already deleted by the main loop above (source col matched by id
        // but its dest title is stale, so we'd otherwise re-target the same
        // row by title).
        if (destCol.id && removedDestColIds.has(destCol.id)) continue;
        const sourceCol = sourceColByTitle.get(destTitle);
        const visibleInNewView =
          !!sourceCol &&
          !!sourceCol.id &&
          !sourceCol.system &&
          visibleSourceColIds.has(sourceCol.id);
        if (visibleInNewView) continue;
        await this.removeSyncedField(
          context,
          oldSync,
          mainDest as Model,
          destCol,
          patch.req,
        );
        anyRemoved = true;
      }
    }

    // Refresh column-mappings after every diff — adds get a new row,
    // removes have their row deleted inside removeSyncedField. The helper
    // is idempotent: existing mappings are skipped, only new dest cols get
    // a row inserted. Cheap walk over each mapping's columns.
    //
    // Re-fetch the sync's mappings — adding an LTAR with a picked view
    // inserts a NEW LinkedShadow mapping inside `addSyncedField` that is
    // NOT in the stale `oldSync.mappings` we were handed. Walking the
    // stale list would skip the new shadow and leave it with zero
    // column-mappings, so the shadow rows would later land with system
    // fields only.
    if (anyAdded || anyRemoved) {
      const freshSync = await TableSync.get(context, oldSync.id);
      for (const m of freshSync?.mappings ?? []) {
        if (m.role === TableSyncMappingRole.Junction) continue;
        await this.writeColumnMappingsForTableMapping(m);
      }
    }

    return { added: anyAdded, removed: anyRemoved };
  }

  /** Airtable-style "keep both" rename on a dest title/column_name conflict.
   *  Returns the input unchanged if neither side collides with any column in
   *  `destColumns`; otherwise walks `${base} N` (N starts at 2) until both
   *  `title` and `column_name` are free. Suffixing column_name flows through
   *  `sanitizeColumnName` so the DB-level name stays a valid identifier even
   *  when the user-facing title has spaces / punctuation.
   *
   *  Used everywhere we materialise a synced column on the destination, so a
   *  pre-existing column (user-created OR a stale synced col from a prior
   *  source rename) never causes columnAdd to throw "duplicate column alias". */
  private resolveUniqueDestColumnName(
    destColumns: { title?: string | null; column_name?: string | null }[],
    candidate: { title: string; column_name: string },
  ): { title: string; column_name: string } {
    const usedTitles = new Set(
      destColumns.map((c) => c.title).filter(Boolean) as string[],
    );
    const usedColumnNames = new Set(
      destColumns.map((c) => c.column_name).filter(Boolean) as string[],
    );

    if (
      !usedTitles.has(candidate.title) &&
      !usedColumnNames.has(candidate.column_name)
    ) {
      return candidate;
    }

    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidateTitle = `${candidate.title} ${i}`;
      const candidateColumnName = sanitizeColumnName(
        `${candidate.column_name}_${i}`,
      );
      if (
        !usedTitles.has(candidateTitle) &&
        !usedColumnNames.has(candidateColumnName)
      ) {
        return {
          title: candidateTitle,
          column_name: candidateColumnName,
        };
      }
      i++;
    }
  }

  /** Dedupe an array of synced column defs (used at `tableCreate` time before
   *  the dest table exists, so we can't ask the DB for taken slots — we
   *  carry-forward a running "seen" set instead). Each def whose `title` or
   *  `column_name` collides with a prior def in the same batch gets bumped to
   *  `${base} 2` / `${base} 3` ... so a source with duplicate aliases never
   *  produces a duplicate-alias failure at table creation. */
  private dedupeSyncedColumnDefs<
    T extends { title?: string | null; column_name?: string | null },
  >(defs: T[]): T[] {
    const seen: { title: string; column_name: string }[] = [];
    return defs.map((d) => {
      const candidate = {
        title: d.title ?? '',
        column_name: d.column_name ?? sanitizeColumnName(String(d.title ?? '')),
      };
      const resolved = this.resolveUniqueDestColumnName(seen, candidate);
      seen.push(resolved);
      return {
        ...d,
        title: resolved.title,
        column_name: resolved.column_name,
      };
    });
  }

  /** Add a single field to a live sync. Mirrors createSync's per-column
   *  branching: Links → Number; LTAR with a valid picked view → shadow +
   *  junction + custom MM LTAR; LTAR without a picked view → SingleLineText
   *  placeholder; everything else → `toDestColumnDef`. */
  private async addSyncedField(
    context: NcContext,
    sourceCtx: NcContext,
    sync: TableSync,
    mainDest: Model,
    sourceTable: Model,
    col: ColumnType,
    linkViewByColumn: Record<string, string>,
    req: NcRequest,
    /** Title/column_name to use on the dest side when the source's own title
     *  collides with a pre-existing user-created column. See the collision
     *  branch in `reconcileFields` for the rename policy. */
    destOverride?: { title: string; column_name: string },
  ): Promise<void> {
    const destBaseId = context.base_id;
    const destTitle = destOverride?.title ?? col.title!;
    const destColumnName =
      destOverride?.column_name ??
      col.column_name ??
      sanitizeColumnName(col.title!);

    if (isLinksOrLTAR(col)) {
      if (col.uidt === UITypes.Links) {
        await this.columnsService.columnAdd(
          { ...context, socket_id: null },
          {
            tableId: mainDest.id,
            column: {
              title: destTitle,
              column_name: destColumnName,
              uidt: UITypes.Number,
              readonly: true,
            } as unknown as Parameters<
              typeof this.columnsService.columnAdd
            >[1]['column'],
            user: req.user,
            req,
            apiVersion: NcApiVersion.V3,
          },
        );
        return;
      }

      const linkedTableId = (col.colOptions as { fk_related_model_id?: string })
        ?.fk_related_model_id;
      if (!linkedTableId) return;

      const userPick = linkViewByColumn[col.title!];

      let resolvedView:
        | { id: string; uuid: string; password: string | null; title?: string }
        | undefined;
      let linkedTable: Model | undefined;

      if (userPick) {
        linkedTable =
          linkedTableId === sourceTable.id
            ? sourceTable
            : (await Model.getWithInfo(sourceCtx, { id: linkedTableId })) ??
              undefined;
        if (!linkedTable) {
          NcError.get(sourceCtx).tableNotFound(linkedTableId);
        }
        if ((linkedTable.primaryKeys?.length ?? 0) > 1) {
          NcError.get(sourceCtx).invalidRequestBody(
            `Linked table "${linkedTable.title || linkedTableId}" for column "${
              col.title
            }" has a composite primary key. Table sync requires a single-column primary key.`,
          );
        }

        const picked = linkedTable.views?.find((v) => v.id === userPick);
        if (!picked) {
          NcError.get(sourceCtx).viewNotFound(userPick);
        }
        if (picked.type !== ViewTypes.GRID) {
          NcError.get(sourceCtx).invalidRequestBody(
            `Linked view "${picked.title || userPick}" for column "${
              col.title
            }" must be a Grid view`,
          );
        }
        if (!picked.allow_sync) {
          NcError.get(sourceCtx).forbidden(
            `Sync is not enabled on the linked view "${
              picked.title || userPick
            }" used by column "${
              col.title
            }". Enable "Allow sync" on the view to use this link.`,
          );
        }
        if (!picked.uuid) {
          NcError.get(sourceCtx).forbidden(
            `Linked view "${picked.title || userPick}" for column "${
              col.title
            }" is not publicly shared`,
          );
        }

        resolvedView = {
          id: picked.id,
          uuid: picked.uuid,
          password: picked.password ?? null,
          title: picked.title,
        };
      }

      // No valid linked view → fall back to SingleLineText placeholder so
      // the user still gets the comma-joined PV summary, matching the
      // create-time default.
      if (!resolvedView || !linkedTable) {
        await this.columnsService.columnAdd(
          { ...context, socket_id: null },
          {
            tableId: mainDest.id,
            column: {
              title: destTitle,
              column_name: destColumnName,
              uidt: UITypes.SingleLineText,
              readonly: true,
            } as unknown as Parameters<
              typeof this.columnsService.columnAdd
            >[1]['column'],
            user: req.user,
            req,
            apiVersion: NcApiVersion.V3,
          },
        );
        return;
      }

      const pickedViewColumns = await View.getColumns(
        sourceCtx,
        resolvedView.id,
      );
      const visibleColIds = new Set<string>(
        pickedViewColumns.filter((c) => c.show).map((c) => c.fk_column_id),
      );

      const linkedColumns: ReturnType<typeof toDestColumnDef>[] = [];
      for (const lcol of linkedTable.columns ?? []) {
        if (lcol.system) continue;
        if (!lcol.title || !lcol.uidt) continue;
        if (SYSTEM_REMOTE_TITLES.has(lcol.title)) continue;
        if (SKIP_UIDTS.has(lcol.uidt)) continue;
        if (!lcol.id || !visibleColIds.has(lcol.id)) continue;

        if (isLinksOrLTAR(lcol)) {
          if (isCrossBaseLink(lcol) || isCustomLink(lcol)) continue;
          if (lcol.uidt === UITypes.Links) {
            linkedColumns.push({
              title: lcol.title,
              column_name: lcol.column_name ?? sanitizeColumnName(lcol.title),
              uidt: UITypes.Number,
              readonly: true,
            });
            continue;
          }
          const backRelatedId = (
            lcol.colOptions as { fk_related_model_id?: string }
          )?.fk_related_model_id;
          if (backRelatedId === sourceTable.id) continue;
          linkedColumns.push({
            title: lcol.title,
            column_name: lcol.column_name ?? sanitizeColumnName(lcol.title),
            uidt: UITypes.SingleLineText,
            readonly: true,
          });
          continue;
        }

        linkedColumns.push(toDestColumnDef(lcol));
      }

      const linkedDest = await this.createDestinationTable(
        context,
        destBaseId,
        {
          title: linkedTable.title || linkedTable.id!,
          columns: linkedColumns,
        },
        req,
      );

      await TableSyncMapping.insert(context, {
        fk_table_sync_id: sync.id,
        source_workspace_id: sourceCtx.workspace_id,
        source_base_id: sourceCtx.base_id,
        source_table_id: linkedTable.id!,
        source_view_id: resolvedView.id,
        source_uuid: resolvedView.uuid,
        source_password_hash: resolvedView.password ?? null,
        dest_base_id: destBaseId,
        dest_table_id: linkedDest.id,
        role: TableSyncMappingRole.LinkedShadow,
      });

      await this.createLinkColumn(
        context,
        sync,
        mainDest,
        linkedDest,
        {
          sourceColumnTitle: destTitle,
          sourceColumnName: destColumnName,
        },
        req,
      );
      return;
    }

    const defaultDef = toDestColumnDef(col);
    await this.columnsService.columnAdd(
      { ...context, socket_id: null },
      {
        tableId: mainDest.id,
        column: {
          ...defaultDef,
          title: destTitle,
          column_name: destColumnName,
        } as unknown as Parameters<
          typeof this.columnsService.columnAdd
        >[1]['column'],
        user: req.user,
        req,
        apiVersion: NcApiVersion.V3,
      },
    );
  }

  /** Create the junction table + custom-MM LTAR pair that wires
   *  `mainDest` ↔ `linkedDest`. Inserts the Junction mapping row but
   *  expects the caller to have already inserted the LinkedShadow mapping
   *  for `linkedDest` (the shadow may be reused across multiple links). */
  private async createLinkColumn(
    context: NcContext,
    sync: TableSync,
    mainDest: Model,
    linkedDest: Model,
    link: { sourceColumnTitle: string; sourceColumnName: string },
    req: NcRequest,
  ): Promise<void> {
    const destBaseId = context.base_id;

    await mainDest.getColumns(context);
    const mainRemoteIdColId = mainDest.columns?.find(
      (c) => c.title === 'RemoteId',
    )?.id;
    if (!mainRemoteIdColId) {
      NcError.get(context).internalServerError(
        'Synced main table is missing the RemoteId column required for link junctions',
      );
    }

    await linkedDest.getColumns(context);
    const linkedRemoteIdColId = linkedDest.columns?.find(
      (c) => c.title === 'RemoteId',
    )?.id;
    if (!linkedRemoteIdColId) {
      NcError.get(context).internalServerError(
        'Linked shadow table is missing the RemoteId column required for link junctions',
      );
    }

    const destBase = await Base.get(context, destBaseId);

    const { parentCn, childCn } = getMMColumnNames(mainDest, linkedDest);
    const baseJnName = await getJunctionTableName(
      { base: destBase! },
      mainDest,
      linkedDest,
    );
    const { table_name: jnTableName } = await this.resolveAvailableTableTitle(
      { ...context, base_id: destBaseId },
      destBaseId,
      baseJnName,
    );

    const junctionTable = await this.tablesService.tableCreate(
      { ...context, socket_id: null },
      {
        baseId: destBaseId,
        table: {
          title: jnTableName,
          table_name: jnTableName,
          columns: [
            {
              title: parentCn,
              column_name: parentCn,
              uidt: UITypes.SingleLineText,
              readonly: true,
            },
            {
              title: childCn,
              column_name: childCn,
              uidt: UITypes.SingleLineText,
              readonly: true,
            },
          ],
        },
        apiVersion: NcApiVersion.V3,
        synced: true,
        mm: true,
        user: req.user,
        req,
      },
    );

    const juncParentColId = junctionTable.columns?.find(
      (c) => c.column_name === parentCn,
    )?.id;
    const juncChildColId = junctionTable.columns?.find(
      (c) => c.column_name === childCn,
    )?.id;
    if (!juncParentColId || !juncChildColId) {
      NcError.get(context).internalServerError(
        'Junction table missing FK columns after creation',
      );
    }

    await this.columnsService.columnAdd(
      { ...context, socket_id: null },
      {
        tableId: mainDest.id,
        column: {
          title: link.sourceColumnTitle,
          column_name: link.sourceColumnName,
          uidt: UITypes.LinkToAnotherRecord,
          type: RelationTypes.MANY_TO_MANY,
          readonly: true,
          is_custom_link: true,
          custom: {
            base_id: destBaseId,
            column_id: mainRemoteIdColId,
            junc_base_id: destBaseId,
            junc_model_id: junctionTable.id,
            junc_column_id: juncParentColId,
            junc_ref_column_id: juncChildColId,
            ref_model_id: linkedDest.id,
            ref_column_id: linkedRemoteIdColId,
          },
        } as unknown as Parameters<
          typeof this.columnsService.columnAdd
        >[1]['column'],
        user: req.user,
        req,
        apiVersion: NcApiVersion.V3,
      },
    );

    await linkedDest.getColumns(context);
    const reverseCol = linkedDest.columns?.find(
      (c) => c.colOptions?.fk_mm_model_id === junctionTable.id,
    );
    if (reverseCol) {
      const siblingTitles = new Set(
        (linkedDest.columns ?? [])
          .filter((c) => c.id !== reverseCol.id && c.title)
          .map((c) => c.title!),
      );
      let reverseTitle = mainDest.title;
      for (let i = 1; siblingTitles.has(reverseTitle); i++) {
        reverseTitle = `${mainDest.title} (${i})`;
      }
      await this.columnsService.columnUpdate(
        { ...context, socket_id: null },
        {
          columnId: reverseCol.id,
          column: {
            ...reverseCol,
            title: reverseTitle,
          },
          user: req.user,
          req,
          apiVersion: NcApiVersion.V3,
          bypassSyncedFieldGuard: true,
        },
      );
    }

    await TableSyncMapping.insert(context, {
      fk_table_sync_id: sync.id,
      source_workspace_id: null,
      source_base_id: null,
      source_table_id: null,
      source_view_id: null,
      source_uuid: null,
      source_password_hash: null,
      dest_base_id: destBaseId,
      dest_table_id: junctionTable.id,
      role: TableSyncMappingRole.Junction,
    });
  }

  /** Drop a synced field from the destination. For plain columns this is a
   *  straight `columnDelete`; for custom-MM LTARs it cascades through the
   *  junction table and (if no other LTAR on the main table still
   *  references it) the linked shadow, plus the matching
   *  `TableSyncMapping` rows. The per-column mapping row is removed first
   *  so a failure later in the cascade still leaves a clean breadcrumb. */
  async removeSyncedField(
    context: NcContext,
    sync: TableSync,
    mainDest: Model,
    destCol: Column,
    req: NcRequest,
    opts: {
      /** Skip the ref-counted shadow-drop step. Used by the linked-source
       *  table-delete handler, which wants the LTAR + junction torn down
       *  but the shadow KEPT as a regular (now-unsynced) table — the
       *  user's data still lives in it. */
      keepShadow?: boolean;
    } = {},
  ): Promise<void> {
    const skipTrash = true;
    // Soft path stamps dropped tables with the sync so the trash handler admits
    // a junction (mm) into trash (its `isSyncDrop` allowance) and groups them.
    const trashParent = skipTrash
      ? undefined
      : { type: 'tableSync', id: sync.id, name: sync.title };

    // Drop the column-mapping row first — failure later in the cascade
    // still leaves a usable state (mapping gone, dest col stuck readonly
    // which the user can address). Reverse order would risk an orphan
    // row pointing at a deleted column.
    if (destCol.id) {
      const cm = await TableSyncColumnMapping.getByDestColumn(
        context,
        destCol.id,
      );
      if (cm) await TableSyncColumnMapping.deleteById(context, cm.id);
    }

    const colOpts = destCol.colOptions as
      | {
          fk_mm_model_id?: string;
          fk_related_model_id?: string;
          type?: string;
        }
      | undefined;

    // Inline the M2M LTAR check directly into the `if` so TS narrows
    // `colOpts` and `colOpts.fk_mm_model_id` to non-null inside the
    // block — no `!` assertions on access.
    if (
      destCol.uidt === UITypes.LinkToAnotherRecord &&
      colOpts?.fk_mm_model_id
    ) {
      const junctionId = colOpts.fk_mm_model_id;
      const shadowId = colOpts.fk_related_model_id;

      await this.columnsService.columnDelete(
        { ...context, socket_id: null },
        {
          columnId: destCol.id,
          req,
          forceDeleteSystem: true,
          skipTrash,
        },
      );

      // Look at the live main columns again — by now the LTAR is gone, so
      // any remaining LTAR pointing at this shadow tells us another link
      // still uses it and we must keep the shadow alive.
      const refreshedMain = await Model.getWithInfo(context, {
        id: mainDest.id,
      });
      const stillReferencingShadow = (refreshedMain?.columns ?? []).some(
        (c) =>
          c.uidt === UITypes.LinkToAnotherRecord &&
          (c.colOptions as { fk_related_model_id?: string })
            ?.fk_related_model_id === shadowId,
      );

      const mappings = await TableSyncMapping.listBySyncId(context, sync.id);

      const junctionMapping = mappings.find(
        (m) =>
          m.role === TableSyncMappingRole.Junction &&
          m.dest_table_id === junctionId,
      );
      if (junctionMapping) {
        try {
          await this.tablesService.tableDelete(
            {
              ...context,
              base_id: junctionMapping.dest_base_id,
              socket_id: null,
            },
            {
              tableId: junctionMapping.dest_table_id,
              req,
              forceDeleteSyncs: true,
              forceDeleteRelations: true,
              skipTrash,
              parent: trashParent,
            },
          );
        } catch (e) {
          this.logger.warn(
            `removeSyncedField: failed to drop junction ${
              junctionMapping.dest_table_id
            }: ${(e as Error).message}`,
          );
        }
        // Drop the sync's own junction mapping rows in BOTH paths — the
        // forward state must reflect the removal (no stale junction mapping).
        // On the soft path the table still goes to trash for macro undo, which
        // rebuilds these rows from the prevMappings snapshot via
        // `replaceMappingSet`; the table-trash handler's suspend recorded the
        // (now-removed) id, and its restore reactivation is a tolerant no-op.
        await TableSyncColumnMapping.deleteByTableSyncMapping(
          context,
          junctionMapping.id,
        );
        await TableSyncMapping.deleteById(context, junctionMapping.id);
      }

      if (shadowId && !stillReferencingShadow && !opts.keepShadow) {
        const shadowMapping = mappings.find(
          (m) =>
            m.role === TableSyncMappingRole.LinkedShadow &&
            m.dest_table_id === shadowId,
        );
        if (shadowMapping) {
          try {
            await this.tablesService.tableDelete(
              {
                ...context,
                base_id: shadowMapping.dest_base_id,
                socket_id: null,
              },
              {
                tableId: shadowMapping.dest_table_id,
                req,
                forceDeleteSyncs: true,
                skipTrash,
                parent: trashParent,
              },
            );
          } catch (e) {
            this.logger.warn(
              `removeSyncedField: failed to drop shadow ${
                shadowMapping.dest_table_id
              }: ${(e as Error).message}`,
            );
          }
          // Drop the shadow's mapping rows in BOTH paths (see the junction
          // branch above). Shadow has column-mappings for every linked-table
          // column it mirrored — drop those before the parent mapping so their
          // cache lists are clean. On the soft path the table is in trash and
          // macro undo rebuilds these rows from the prevMappings snapshot.
          await TableSyncColumnMapping.deleteByTableSyncMapping(
            context,
            shadowMapping.id,
          );
          await TableSyncMapping.deleteById(context, shadowMapping.id);
        }
      }
      return;
    }

    await this.columnsService.columnDelete(
      { ...context, socket_id: null },
      {
        columnId: destCol.id,
        req,
        forceDeleteSystem: true,
        skipTrash,
      },
    );
  }

  @Untraced()
  async manualResync(
    context: NcContext,
    params: { syncId: string; req: NcRequest },
  ): Promise<TableSync> {
    const { syncId: id, req } = params;
    const sync = await TableSync.get(context, id);

    if (!sync) NcError.get(context).tableSyncNotFound(id);

    if (sync.status === TableSyncStatus.Syncing) {
      NcError.get(context).invalidRequestBody(
        `Sync "${sync.title}" is already syncing`,
      );
    }

    await TableSync.update(context, id, {
      status: TableSyncStatus.Syncing,
    });

    const updated = await this.enqueueJobOrRevert(context, id, {
      mode: 'full-resync',
      req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...updated, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return updated;
  }

  @TraceCommand(OperationName.tableSyncFreeze)
  async freezeSync(
    context: NcContext,
    params: { syncId: string; req: NcRequest },
  ): Promise<TableSync> {
    const { syncId: id, req } = params;
    const existing = await TableSync.get(context, id);

    if (!existing) NcError.get(context).tableSyncNotFound(id);

    const sync = await TableSync.update(context, id, {
      status: TableSyncStatus.Paused,
      updated_by: req.user?.id,
    });

    this.appHooksService.emit(AppEvents.TABLE_SYNC_FREEZE, {
      context,
      req,
      sync,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...sync, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return sync;
  }

  @TraceCommand(OperationName.tableSyncResume)
  async resumeSync(
    context: NcContext,
    params: { syncId: string; req: NcRequest },
  ): Promise<TableSync> {
    const { syncId: id, req } = params;
    const existing = await TableSync.get(context, id);

    if (!existing) NcError.get(context).tableSyncNotFound(id);

    if (existing.status === TableSyncStatus.Syncing) {
      NcError.get(context).invalidRequestBody(
        `Sync "${existing.title}" is syncing — cannot resume mid-copy`,
      );
    }

    if (existing.status === TableSyncStatus.Active) {
      return existing;
    }
    await TableSync.update(context, id, {
      status: TableSyncStatus.Syncing,
      last_error: null,
      updated_by: req.user?.id,
    });

    const sync = await this.enqueueJobOrRevert(context, id, {
      mode: 'full-resync',
      req,
    });

    this.appHooksService.emit(AppEvents.TABLE_SYNC_RESUME, {
      context,
      req,
      sync,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...sync, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return sync;
  }

  @TraceCommand(OperationName.tableSyncCreate)
  async createSync(
    context: NcContext,
    params: { body: TableSyncCreateReqType; req: NcRequest },
  ): Promise<TableSync> {
    const { body: payload, req } = params;

    await checkForFeature(context, PlanFeatureTypes.FEATURE_TABLE_SYNC);

    // Real-time (automatic) sync is a higher-tier feature than manual sync.
    // Gate before payload validation so the plan check is deterministic
    // regardless of the rest of the payload.
    if (
      (payload.sync_trigger ?? TableSyncTrigger.Realtime) ===
      TableSyncTrigger.Realtime
    ) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO);
    }

    validatePayload(
      'swagger.json#/components/schemas/TableSyncCreateReq',
      payload,
    );

    const {
      title,
      source_workspace_id,
      source_base_id,
      source_table_id,
      source_view_id,
      selected_fields,
      link_view_by_column,
      on_delete_action = TableSyncOnDeleteAction.MarkDeleted,
      sync_trigger = TableSyncTrigger.Realtime,
      source_input_mode = TableSyncInputMode.Browse,
      password: sourcePassword,
    } = payload;

    const sourceWorkspaceId = source_workspace_id ?? context.workspace_id;

    // Browse mode trusts workspace ACL for source authorization (the caller
    // is operating inside this workspace and never sees the share password),
    // so it is only valid when the source lives in the SAME workspace. A
    // cross-workspace source must use paste mode, where the share-link
    // password is the sole credential and is verified below. Without this
    // gate, browse mode could pull any allow_sync view from any workspace,
    // bypassing its share password.
    if (
      source_input_mode === TableSyncInputMode.Browse &&
      sourceWorkspaceId !== context.workspace_id
    ) {
      NcError.get(context).forbidden(
        'Browse mode can only sync from a source in the same workspace. Use a share link to sync from another workspace.',
      );
    }

    await this.assertUniqueTitle(context, title);

    const sourceCtx: NcContext = {
      workspace_id: sourceWorkspaceId,
      base_id: source_base_id,
    };

    const sourceTable = await Model.getWithInfo(sourceCtx, {
      id: source_table_id,
    });

    if (!sourceTable) NcError.get(sourceCtx).tableNotFound(source_table_id);

    if ((sourceTable.primaryKeys?.length ?? 0) > 1) {
      NcError.get(sourceCtx).invalidRequestBody(
        `Source table "${
          sourceTable.title || source_table_id
        }" has a composite primary key. Table sync requires a single-column primary key.`,
      );
    }

    const sourceView = await View.get(sourceCtx, source_view_id);

    if (!sourceView || sourceView.fk_model_id !== sourceTable.id) {
      NcError.get(sourceCtx).viewNotFound(source_view_id);
    }

    if (!sourceView.allow_sync) {
      NcError.get(sourceCtx).forbidden(
        `Sync is not enabled on the source view "${
          sourceView.title || source_view_id
        }". Enable "Allow sync" on the view to use it as a sync source.`,
      );
    }

    if (!sourceView.uuid) {
      NcError.get(sourceCtx).forbidden(
        'Source view is not publicly shared. Enable "Allow sync" on the source view first.',
      );
    }

    // Browse-mode caller is in the source workspace and authorized by
    // workspace ACL — they never see the share password. Only paste-mode
    // (link from another workspace, share-link is the only credential)
    // needs the password check here. Same rule applies on the re-bind
    // path in `updateSync`.
    if (sourceView.password && source_input_mode === TableSyncInputMode.Paste) {
      const ok = await View.verifyPassword(sourceView, sourcePassword ?? '');
      if (!ok) {
        NcError.get(sourceCtx).forbidden(
          'Incorrect password for the source share view.',
        );
      }
    }

    const sourceUuid = sourceView.uuid;
    const sourcePasswordHash = sourceView.password ?? null;

    const sourceViewColumns = await View.getColumns(sourceCtx, sourceView.id);
    const visibleSourceColIds = new Set<string>(
      sourceViewColumns.filter((c) => c.show).map((c) => c.fk_column_id),
    );

    const sync = await TableSync.insert(context, {
      ...extractProps(payload, ['title', 'selected_fields']),
      on_delete_action: on_delete_action as TableSyncOnDeleteAction,
      sync_trigger: sync_trigger as TableSyncTrigger,
      source_input_mode: source_input_mode as TableSyncInputMode,
      status: TableSyncStatus.Syncing,
      created_by: req.user?.id,
      updated_by: req.user?.id,
    });

    const destBaseId = context.base_id;

    const createdDestIds: string[] = [];

    const selectedSet = selected_fields ? new Set(selected_fields) : null;

    const isIncluded = (t: string) =>
      selectedSet === null || selectedSet.has(t);

    const linkViewByColumn = link_view_by_column ?? {};

    try {
      const mainColumns: ReturnType<typeof toDestColumnDef>[] = [];
      const pendingLinks: {
        sourceColumnTitle: string;
        sourceColumnName: string;
        linkedDestTableId: string;
      }[] = [];

      // Share a single shadow table across LTARs that point at the same
      // (linked table, picked view) pair. Without this, two LTARs from the
      // main source to the same linked table create duplicate shadow
      // mappings + duplicate dest tables holding the same data.
      // Keyed by `${linkedTable.id}|${pickedViewId}` — different picked
      // views need separate shadows (different filter / visibility set).
      const shadowByLinkedKey = new Map<string, string>();

      // Per-dest-table source-title → dest-title remap captured at dedupe
      // time. `dedupeSyncedColumnDefs` may rename a column on the dest when
      // its sanitized column_name collides with a prior sibling (even if
      // titles differ) — the remap lets `writeColumnMappingsForTableMapping`
      // pair source ↔ dest cols by the renamed dest title instead of by
      // source title equality. Keyed by dest table id.
      const remapByDestTableId = new Map<string, Map<string, string>>();

      for (const col of sourceTable.columns ?? []) {
        if (col.system || !col.title || !col.uidt) continue;
        if (SYSTEM_REMOTE_TITLES.has(col.title)) continue;
        if (SKIP_UIDTS.has(col.uidt)) continue;
        if (!col.id || !visibleSourceColIds.has(col.id)) continue;

        if (isLinksOrLTAR(col)) {
          if (isCrossBaseLink(col) || isCustomLink(col)) continue;
          if (col.uidt === UITypes.Links) {
            if (!col.pv && !isIncluded(col.title)) continue;
            mainColumns.push({
              title: col.title,
              column_name: col.column_name ?? sanitizeColumnName(col.title),
              uidt: UITypes.Number,
              readonly: true,
            });
            continue;
          }

          const linkedTableId = (
            col.colOptions as { fk_related_model_id?: string }
          )?.fk_related_model_id;
          if (!linkedTableId) continue;

          // Field-selection rules for LTAR columns:
          //   1. All-fields mode → always SingleLineText (comma-joined PVs).
          //   2. Specific mode, not selected, not PV → drop entirely.
          //   3. Specific mode, selected, no view picked → SingleLineText.
          //   4. Specific mode, selected, valid view picked → create shadow.
          //   5. Specific mode, selected, INVALID view picked → throw.
          // A view is valid iff it lives on the linked table, has
          // `allow_sync`, is `GRID`, and has a `uuid`. We throw rather than
          // fall back to SingleLineText so the user knows their pick was
          // ignored — otherwise they'd silently get a text column.
          const inAllMode = selectedSet === null;
          const isSelected = inAllMode || selectedSet.has(col.title);

          if (!isSelected && !col.pv) continue;

          const userPick =
            !inAllMode && isSelected ? linkViewByColumn[col.title] : undefined;

          let linkedTable: Model | undefined;
          let resolvedView:
            | {
                id: string;
                uuid: string;
                password: string | null;
                title?: string;
              }
            | undefined;

          if (userPick) {
            linkedTable =
              linkedTableId === sourceTable.id
                ? (sourceTable as Model)
                : (await Model.getWithInfo(sourceCtx, {
                    id: linkedTableId,
                  })) ?? undefined;

            if (!linkedTable) {
              NcError.get(sourceCtx).tableNotFound(linkedTableId);
            }

            if ((linkedTable.primaryKeys?.length ?? 0) > 1) {
              NcError.get(sourceCtx).invalidRequestBody(
                `Linked table "${
                  linkedTable.title || linkedTableId
                }" for column "${
                  col.title
                }" has a composite primary key. Table sync requires a single-column primary key.`,
              );
            }

            const picked = linkedTable.views?.find((v) => v.id === userPick);
            if (!picked) {
              NcError.get(sourceCtx).viewNotFound(userPick);
            }
            if (picked.type !== ViewTypes.GRID) {
              NcError.get(sourceCtx).invalidRequestBody(
                `Linked view "${picked.title || userPick}" for column "${
                  col.title
                }" must be a Grid view`,
              );
            }
            if (!picked.allow_sync) {
              NcError.get(sourceCtx).forbidden(
                `Sync is not enabled on the linked view "${
                  picked.title || userPick
                }" used by column "${
                  col.title
                }". Enable "Allow sync" on the view to use this link.`,
              );
            }
            if (!picked.uuid) {
              NcError.get(sourceCtx).forbidden(
                `Linked view "${picked.title || userPick}" for column "${
                  col.title
                }" is not publicly shared`,
              );
            }

            resolvedView = {
              id: picked.id,
              uuid: picked.uuid,
              password: picked.password ?? null,
              title: picked.title,
            };
          }

          if (!resolvedView) {
            mainColumns.push({
              title: col.title,
              column_name: col.column_name ?? sanitizeColumnName(col.title),
              uidt: UITypes.SingleLineText,
              readonly: true,
            });
            continue;
          }

          if (!linkedTable) continue;

          // Reuse an existing shadow if this (linkedTable, pickedView) pair
          // is already known from a prior LTAR in this same createSync.
          const shadowKey = `${linkedTable.id}|${resolvedView.id}`;
          const existingShadowId = shadowByLinkedKey.get(shadowKey);
          if (existingShadowId) {
            pendingLinks.push({
              sourceColumnTitle: col.title,
              sourceColumnName:
                col.column_name ?? sanitizeColumnName(col.title),
              linkedDestTableId: existingShadowId,
            });
            continue;
          }

          const pickedViewColumns = await View.getColumns(
            sourceCtx,
            resolvedView.id,
          );
          const visibleColIds = new Set<string>(
            pickedViewColumns.filter((c) => c.show).map((c) => c.fk_column_id),
          );

          const linkedColumns: ReturnType<typeof toDestColumnDef>[] = [];
          for (const lcol of linkedTable.columns ?? []) {
            if (lcol.system) continue;
            if (!lcol.title || !lcol.uidt) continue;
            if (SYSTEM_REMOTE_TITLES.has(lcol.title)) continue;
            if (SKIP_UIDTS.has(lcol.uidt)) continue;
            if (!lcol.id || !visibleColIds.has(lcol.id)) continue;

            if (isLinksOrLTAR(lcol)) {
              if (isCrossBaseLink(lcol) || isCustomLink(lcol)) continue;
              if (lcol.uidt === UITypes.Links) {
                linkedColumns.push({
                  title: lcol.title,
                  column_name:
                    lcol.column_name ?? sanitizeColumnName(lcol.title),
                  uidt: UITypes.Number,
                  readonly: true,
                });
                continue;
              }
              // Skip back-references to the source main table — the custom
              // MM `columnAdd` below inserts the real reverse LTAR on the
              // linked shadow itself. Without this skip, the shadow ends up
              // with both a SingleLineText placeholder AND the actual
              // reverse LTAR for the same source relation.
              const backRelatedId = (
                lcol.colOptions as { fk_related_model_id?: string }
              )?.fk_related_model_id;
              if (backRelatedId === sourceTable.id) continue;
              linkedColumns.push({
                title: lcol.title,
                column_name: lcol.column_name ?? sanitizeColumnName(lcol.title),
                uidt: UITypes.SingleLineText,
                readonly: true,
              });
              continue;
            }

            linkedColumns.push(toDestColumnDef(lcol));
          }

          const dedupedLinkedColumns =
            this.dedupeSyncedColumnDefs(linkedColumns);
          const linkedColumnTitleRemap = new Map<string, string>();
          for (let i = 0; i < linkedColumns.length; i++) {
            const before = linkedColumns[i];
            const after = dedupedLinkedColumns[i];
            if (before.title !== after.title && before.title) {
              linkedColumnTitleRemap.set(before.title, after.title!);
            }
          }

          const linkedDest = await this.createDestinationTable(
            context,
            destBaseId,
            {
              title: linkedTable.title || linkedTable.id!,
              columns: dedupedLinkedColumns,
            },
            req,
          );
          createdDestIds.push(linkedDest.id);

          if (linkedColumnTitleRemap.size) {
            remapByDestTableId.set(linkedDest.id, linkedColumnTitleRemap);
          }

          await TableSyncMapping.insert(context, {
            fk_table_sync_id: sync.id,
            source_workspace_id: sourceCtx.workspace_id,
            source_base_id: sourceCtx.base_id,
            source_table_id: linkedTable.id!,
            source_view_id: resolvedView.id,
            source_uuid: resolvedView.uuid,
            source_password_hash: resolvedView.password ?? null,
            dest_base_id: destBaseId,
            dest_table_id: linkedDest.id,
            role: TableSyncMappingRole.LinkedShadow,
          });

          shadowByLinkedKey.set(shadowKey, linkedDest.id);

          pendingLinks.push({
            sourceColumnTitle: col.title,
            sourceColumnName: col.column_name ?? sanitizeColumnName(col.title),
            linkedDestTableId: linkedDest.id,
          });
          continue;
        }

        // PV is synced regardless of selection.
        if (!col.pv && !isIncluded(col.title)) continue;

        mainColumns.push(toDestColumnDef(col));
      }

      // Dedupe so two source cols sharing a title/column_name (or two that
      // collapse to the same sanitized column_name) don't trip tableCreate's
      // duplicate-alias check. Carry the renamed titles back into the
      // pendingLinks rows below so the custom-MM LTAR landing on the dest
      // points at the renamed cols (and the column-mapping writer can pair
      // source ↔ dest by title).
      const dedupedMainColumns = this.dedupeSyncedColumnDefs(mainColumns);
      const mainColumnTitleRemap = new Map<string, string>();
      const mainColumnNameRemap = new Map<string, string>();
      for (let i = 0; i < mainColumns.length; i++) {
        const before = mainColumns[i];
        const after = dedupedMainColumns[i];
        if (before.title !== after.title && before.title) {
          mainColumnTitleRemap.set(before.title, after.title!);
        }
        if (before.column_name !== after.column_name && before.column_name) {
          mainColumnNameRemap.set(before.column_name, after.column_name!);
        }
      }
      for (const link of pendingLinks) {
        const newTitle = mainColumnTitleRemap.get(link.sourceColumnTitle);
        const newName = mainColumnNameRemap.get(link.sourceColumnName);
        if (newTitle) link.sourceColumnTitle = newTitle;
        if (newName) link.sourceColumnName = newName;
      }
      const mainDest = await this.createDestinationTable(
        context,
        destBaseId,
        {
          title: sourceTable.title || sourceTable.id!,
          columns: dedupedMainColumns,
        },
        req,
      );
      createdDestIds.push(mainDest.id);

      if (mainColumnTitleRemap.size) {
        remapByDestTableId.set(mainDest.id, mainColumnTitleRemap);
      }

      const mainRemoteIdColId = mainDest.columns?.find(
        (c) => c.title === 'RemoteId',
      )?.id;
      if (pendingLinks.length && !mainRemoteIdColId) {
        NcError.get(context).internalServerError(
          'Synced main table is missing the RemoteId column required for link junctions',
        );
      }
      const destBase = pendingLinks.length
        ? await Base.get(context, destBaseId)
        : null;

      for (const link of pendingLinks) {
        const linkedDest = await Model.get(context, link.linkedDestTableId);
        if (!linkedDest) {
          NcError.get(context).tableNotFound(link.linkedDestTableId);
        }
        await linkedDest.getColumns(context);
        const linkedRemoteIdColId = linkedDest.columns?.find(
          (c) => c.title === 'RemoteId',
        )?.id;
        if (!linkedRemoteIdColId) {
          NcError.get(context).internalServerError(
            'Linked shadow table is missing the RemoteId column required for link junctions',
          );
        }

        const { parentCn, childCn } = getMMColumnNames(
          mainDest as Model,
          linkedDest as Model,
        );
        const baseJnName = await getJunctionTableName(
          { base: destBase! },
          mainDest as Model,
          linkedDest as Model,
        );
        const { table_name: jnTableName } =
          await this.resolveAvailableTableTitle(
            { ...context, base_id: destBaseId },
            destBaseId,
            baseJnName,
          );

        const junctionTable = await this.tablesService.tableCreate(
          { ...context, socket_id: null },
          {
            baseId: destBaseId,
            table: {
              title: jnTableName,
              table_name: jnTableName,
              columns: [
                {
                  title: parentCn,
                  column_name: parentCn,
                  uidt: UITypes.SingleLineText,
                  readonly: true,
                },
                {
                  title: childCn,
                  column_name: childCn,
                  uidt: UITypes.SingleLineText,
                  readonly: true,
                },
              ],
            },
            apiVersion: NcApiVersion.V3,
            synced: true,
            mm: true,
            user: req.user,
            req,
          },
        );
        createdDestIds.push(junctionTable.id);

        const juncParentColId = junctionTable.columns?.find(
          (c) => c.column_name === parentCn,
        )?.id;
        const juncChildColId = junctionTable.columns?.find(
          (c) => c.column_name === childCn,
        )?.id;
        if (!juncParentColId || !juncChildColId) {
          NcError.get(context).internalServerError(
            'Junction table missing FK columns after creation',
          );
        }

        // Defensive: the LTAR title was set from the source's column title,
        // which can collide with a same-titled regular column already on the
        // main dest (e.g. source has both "Foo" Text and "Foo" Link). Resolve
        // against live mainDest cols to avoid a duplicate-alias failure.
        await mainDest.getColumns(context);
        const ltarResolved = this.resolveUniqueDestColumnName(
          mainDest.columns ?? [],
          {
            title: link.sourceColumnTitle,
            column_name: link.sourceColumnName,
          },
        );

        await this.columnsService.columnAdd(
          { ...context, socket_id: null },
          {
            tableId: mainDest.id,
            column: {
              title: ltarResolved.title,
              column_name: ltarResolved.column_name,
              uidt: UITypes.LinkToAnotherRecord,
              type: RelationTypes.MANY_TO_MANY,
              readonly: true,
              is_custom_link: true,
              custom: {
                base_id: destBaseId,
                column_id: mainRemoteIdColId,
                junc_base_id: destBaseId,
                junc_model_id: junctionTable.id,
                junc_column_id: juncParentColId,
                junc_ref_column_id: juncChildColId,
                ref_model_id: linkedDest.id,
                ref_column_id: linkedRemoteIdColId,
              },
            } as unknown as Parameters<
              typeof this.columnsService.columnAdd
            >[1]['column'],
            user: req.user,
            req,
            apiVersion: NcApiVersion.V3,
          },
        );

        await linkedDest.getColumns(context);
        const reverseCol = linkedDest.columns?.find(
          (c) => c.colOptions?.fk_mm_model_id === junctionTable.id,
        );
        if (reverseCol) {
          // Multiple forward LTARs from main → same linked table each
          // create a reverse on the shadow; renaming them all to
          // `mainDest.title` collapses them into duplicate titles.
          // Uniquify against sibling columns on the shadow.
          const siblingTitles = new Set(
            (linkedDest.columns ?? [])
              .filter((c) => c.id !== reverseCol.id && c.title)
              .map((c) => c.title!),
          );
          let reverseTitle = mainDest.title;
          for (let i = 1; siblingTitles.has(reverseTitle); i++) {
            reverseTitle = `${mainDest.title} (${i})`;
          }

          await this.columnsService.columnUpdate(
            { ...context, socket_id: null },
            {
              columnId: reverseCol.id,
              column: {
                ...reverseCol,
                title: reverseTitle,
              },
              user: req.user,
              req,
              apiVersion: NcApiVersion.V3,
              bypassSyncedFieldGuard: true,
            },
          );
        }

        await TableSyncMapping.insert(context, {
          fk_table_sync_id: sync.id,
          source_workspace_id: null,
          source_base_id: null,
          source_table_id: null,
          source_view_id: null,
          source_uuid: null,
          source_password_hash: null,
          dest_base_id: destBaseId,
          dest_table_id: junctionTable.id,
          role: TableSyncMappingRole.Junction,
        });
      }

      await TableSyncMapping.insert(context, {
        fk_table_sync_id: sync.id,
        source_workspace_id: sourceWorkspaceId,
        source_base_id,
        source_table_id,
        source_view_id,
        source_uuid: sourceUuid,
        source_password_hash: sourcePasswordHash,
        dest_base_id: destBaseId,
        dest_table_id: mainDest.id,
        role: TableSyncMappingRole.Main,
      });

      // All dest tables + TableSyncMappings exist now — write per-column
      // mappings so source-side events (rename, type change, delete) can
      // find their dest cols by id rather than title. Pass any dedupe
      // remap so cols renamed at create time still pair source ↔ dest.
      const fullSync = await TableSync.get(context, sync.id);
      if (fullSync) {
        for (const m of fullSync.mappings ?? []) {
          if (m.role === TableSyncMappingRole.Junction) continue;
          await this.writeColumnMappingsForTableMapping(
            m,
            remapByDestTableId.get(m.dest_table_id),
          );
        }
      }

      await this.enqueueJobOrRevert(context, sync.id, {
        mode: 'full-create',
        req,
      });
    } catch (e) {
      this.logger.error(
        `createSync failed for "${title}", rolling back: ${
          (e as Error).message
        }`,
        (e as Error).stack,
      );
      for (const id of [...createdDestIds].reverse()) {
        try {
          await this.tablesService.tableDelete(
            { ...context, socket_id: null },
            {
              tableId: id,
              req,
              forceDeleteSyncs: true,
              skipTrash: true,
            },
          );
        } catch (rollbackErr) {
          this.logger.error(
            `Rollback failed to delete destination table ${id}: ${
              (rollbackErr as Error).message
            }`,
            (rollbackErr as Error).stack,
          );
        }
      }
      try {
        await TableSync.delete(context, sync.id);
      } catch (rollbackErr) {
        this.logger.error(
          `Rollback failed to delete sync record ${sync.id}: ${
            (rollbackErr as Error).message
          }`,
          (rollbackErr as Error).stack,
        );
      }
      throw e;
    }

    const created = await TableSync.get(context, sync.id);

    if (created) {
      this.appHooksService.emit(AppEvents.TABLE_SYNC_CREATE, {
        context,
        req,
        sync: created,
      });

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'table_sync_create',
            payload: { ...created, base_id: context.base_id },
          },
        },
        context.socket_id,
      );
    }

    return created;
  }

  @TraceCommand(OperationName.tableSyncDelete)
  async delete(
    context: NcContext,
    params: {
      syncId: string;
      req: NcRequest;
      dropTables?: boolean;
      skipTrash?: boolean;
    },
  ): Promise<boolean> {
    const { syncId: id, req, dropTables = false, skipTrash = false } = params;
    const sync = await TableSync.get(context, id);
    if (!sync) NcError.get(context).tableSyncNotFound(id);

    if (!skipTrash) {
      await this.baseTrashService.trashResource(context, {
        resourceId: id,
        resourceType: 'tableSync',
        user: req.user,
        req,
        options: { dropTables },
      });

      this.appHooksService.emit(AppEvents.TABLE_SYNC_DELETE, {
        context,
        req,
        sync,
        droppedTables: dropTables,
      });

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'table_sync_delete',
            payload: { id: sync.id, base_id: context.base_id },
          },
        },
        context.socket_id,
      );

      return true;
    }

    const mappings = sync.mappings ?? [];

    if (dropTables) {
      const orderedMappings = [...mappings].sort(
        (a, b) =>
          (a.role === TableSyncMappingRole.Junction ? 1 : 0) -
          (b.role === TableSyncMappingRole.Junction ? 1 : 0),
      );

      for (const m of orderedMappings) {
        const destCtx: NcContext = {
          ...context,
          base_id: m.dest_base_id,
          socket_id: null,
        };
        const exists = await Model.get(destCtx, m.dest_table_id);
        if (!exists) continue;
        try {
          await this.tablesService.tableDelete(destCtx, {
            tableId: m.dest_table_id,
            req,
            forceDeleteSyncs: true,
            forceDeleteRelations: true,
            skipTrash: true,
          });
        } catch (e) {
          this.logger.warn(
            `delete(skipTrash): failed to drop dest table ${m.dest_table_id}: ${
              (e as Error).message
            }`,
          );
        }
      }
    } else {
      for (const m of mappings) {
        // Junction tables back custom-MM LTARs on the main mirror — their FK
        // columns are created `readonly:true` so users can only mutate links
        // via the parent LTAR's link-write path, never by editing junction
        // rows directly. Unsync-keep-data must preserve that contract: leave
        // the junction table as-is (still `synced=true`, FKs still readonly)
        // so the LTAR on the main mirror keeps routing through it. The
        // mapping row itself is cleaned up by `TableSync.delete` below.
        if (m.role === TableSyncMappingRole.Junction) continue;

        const destCtx: NcContext = { ...context, base_id: m.dest_base_id };
        try {
          const model = await Model.get(destCtx, m.dest_table_id);
          if (!model) continue;
          await model.getColumns(destCtx);

          await Model.updateSynced(destCtx, m.dest_table_id, false);

          for (const col of model.columns ?? []) {
            if (col.readonly && col.id) {
              await Column.update2(destCtx, {
                colId: col.id,
                column: { readonly: false },
                isSimpleUpdate: true,
              });
            }
          }

          const table = await Model.getWithInfo(context, {
            id: model.id,
          });

          NocoSocket.broadcastEvent(context, {
            event: EventType.META_EVENT,
            payload: {
              action: 'table_update',
              payload: table,
            },
          });
        } catch (e) {
          this.logger.warn(
            `unsync dest table ${m.dest_table_id} failed: ${
              (e as Error).message
            }`,
          );
        }
      }
    }

    await TableSync.delete(context, id);

    this.appHooksService.emit(AppEvents.TABLE_SYNC_DELETE, {
      context,
      req,
      sync,
      droppedTables: dropTables,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_delete',
          payload: { id: sync.id, base_id: context.base_id },
        },
      },
      context.socket_id,
    );

    return true;
  }

  async resolveLink(
    context: NcContext,
    params: { url?: string; uuid?: string; password?: string },
  ): Promise<{
    workspace_id: string;
    base_id: string;
    table_id: string;
    view_id: string;
    has_password: boolean;
    source_table_missing: boolean;
    columns: Column[];
    views: View[];
    visible_source_column_ids: string[];
  }> {
    validatePayload(
      'swagger.json#/components/schemas/TableSyncResolveLinkReq',
      params,
    );

    const uuid = params.uuid || extractShareUuid(params.url ?? '');
    if (!uuid) {
      NcError.get(context).invalidRequestBody(
        'Provide a valid share-view URL or uuid',
      );
    }

    const view = await View.getByUUID(context, uuid);
    if (!view) NcError.get(context).viewNotFound(uuid);

    if (view.password) {
      const ok = await View.verifyPassword(view, params.password ?? '');
      if (!ok) {
        NcError.get(context).forbidden('Incorrect share password');
      }
    }

    if (!view.allow_sync) {
      NcError.get(context).forbidden(
        'Source view does not allow sync. Ask the owner to enable "Allow sync" on the source view.',
      );
    }

    // The share view IS the authorization here — read the source schema in the
    // same call so create (paste mode) never has to fall back to base-ACL
    // guarded `tableGet`/`viewColumnList`, which 403 when the importing user
    // has no access to the source base.
    const sourceCtx: NcContext = {
      workspace_id: view.fk_workspace_id!,
      base_id: view.base_id!,
    };
    const schema = await this.buildSourceSchema(
      sourceCtx,
      view.fk_model_id!,
      view.id!,
    );

    return {
      workspace_id: view.fk_workspace_id!,
      base_id: view.base_id!,
      table_id: view.fk_model_id!,
      view_id: view.id!,
      has_password: !!view.password,
      ...schema,
    };
  }

  private async resolveAvailableTableTitle(
    context: NcContext,
    baseId: string,
    desiredTitle: string,
  ): Promise<{ title: string; table_name: string }> {
    const baseTableName =
      desiredTitle.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || desiredTitle;
    for (let i = 0; i < 1000; i++) {
      const title = i === 0 ? desiredTitle : `${desiredTitle} (${i})`;
      const table_name = i === 0 ? baseTableName : `${baseTableName}_${i}`;
      const [titleOk, tableNameOk] = await Promise.all([
        Model.checkAliasAvailable(context, {
          title,
          base_id: baseId,
        } as any),
        Model.checkTitleAvailable(context, {
          table_name,
          base_id: baseId,
        } as any),
      ]);
      if (titleOk && tableNameOk) return { title, table_name };
    }
    NcError.get(context).invalidRequestBody(
      `Could not allocate a unique table name for "${desiredTitle}"`,
    );
  }

  /** Walk a (Main or LinkedShadow) table-mapping, match each sync-eligible
   *  source column to its dest column by title, and insert
   *  `nc_table_sync_column_mappings` rows. Idempotent — skips any source
   *  column already mapped to a dest column.
   *
   *  Called once at the end of `createSync` for the full set of mappings,
   *  and again from `addSyncedField` paths so incremental adds also write
   *  their column-mapping rows.
   *
   *  Junction mappings have no source counterpart and are skipped. Sync
   *  system cols (`RemoteId`, `RemoteUpdatedAt`, etc.) have no source
   *  column either — they're filtered out by `SYSTEM_REMOTE_TITLES`.
   *
   *  Title-matching is the *only* source-of-truth available at create
   *  time (no other identifier has been written yet). After this run, all
   *  subsequent lookups go through `source_column_id`, which survives
   *  source-side renames. */
  /** Title-keyed source→dest column mapping writer.
   *
   *  `sourceTitleToDestTitle` carries forward any renames that happened on
   *  the dest at creation time (see `dedupeSyncedColumnDefs` —
   *  `resolveUniqueDestColumnName` bumps both `title` and `column_name`
   *  when EITHER collides, so two source cols with different titles whose
   *  sanitized `column_name`s collide produce a dest col whose title no
   *  longer matches the source). Without this remap, the title-equality
   *  lookup below would silently drop those mappings — leaving the renamed
   *  source col unmapped and subsequent rename/type/delete events on it
   *  with no dest col to apply against. `reconcileFields` handles the
   *  equivalent live-sync case by inserting the mapping inline
   *  (`table-sync.service.ts:469-486`). */
  private async writeColumnMappingsForTableMapping(
    mapping: TableSyncMapping,
    sourceTitleToDestTitle?: Map<string, string>,
  ): Promise<void> {
    if (!mapping.source_table_id) return; // Junction — no source

    const sourceCtx: NcContext = {
      workspace_id: mapping.source_workspace_id,
      base_id: mapping.source_base_id,
    };
    const destCtx: NcContext = {
      workspace_id: mapping.fk_workspace_id,
      base_id: mapping.dest_base_id,
    };

    const sourceModel = await Model.get(sourceCtx, mapping.source_table_id);
    if (!sourceModel) return;
    await sourceModel.getColumns(sourceCtx);

    const destModel = await Model.get(destCtx, mapping.dest_table_id);
    if (!destModel) return;
    await destModel.getColumns(destCtx);

    const destByTitle = new Map<string, Column>();
    for (const c of destModel.columns ?? []) {
      if (c.title) destByTitle.set(c.title, c as Column);
    }

    for (const sourceCol of sourceModel.columns ?? []) {
      if (sourceCol.system || !sourceCol.title || !sourceCol.uidt) continue;
      if (!sourceCol.id) continue;
      if (SYSTEM_REMOTE_TITLES.has(sourceCol.title)) continue;
      if (SKIP_UIDTS.has(sourceCol.uidt)) continue;
      if (
        isLinksOrLTAR(sourceCol) &&
        (isCrossBaseLink(sourceCol) || isCustomLink(sourceCol))
      ) {
        continue;
      }

      // Honor any rename applied by `dedupeSyncedColumnDefs` at create
      // time — the dest col may live under a different title than the
      // source.
      const lookupTitle =
        sourceTitleToDestTitle?.get(sourceCol.title) ?? sourceCol.title;
      const destCol = destByTitle.get(lookupTitle);
      if (!destCol?.id) continue;

      // User-created dest col happens to share the source title — the rename branch in reconcileFields already
      // synced the source col under a different title and inserted its
      // mapping directly. Skip so we don't overwrite the user's column with
      // a stray sync mapping.
      if (!destCol.readonly) continue;

      // Idempotent — if a column-mapping for this dest col already exists,
      // skip (a re-run shouldn't double-insert).
      const existing = await TableSyncColumnMapping.getByDestColumn(
        destCtx,
        destCol.id,
      );
      if (existing) continue;

      await TableSyncColumnMapping.insert(destCtx, {
        fk_table_sync_id: mapping.fk_table_sync_id,
        fk_table_sync_mapping_id: mapping.id,
        source_workspace_id: mapping.source_workspace_id,
        source_base_id: mapping.source_base_id,
        source_table_id: mapping.source_table_id,
        source_column_id: sourceCol.id,
        dest_base_id: mapping.dest_base_id,
        dest_table_id: mapping.dest_table_id,
        dest_column_id: destCol.id,
      });
    }
  }

  private async createDestinationTable(
    context: NcContext,
    destBaseId: string,
    spec: { title: string; columns: ReturnType<typeof toDestColumnDef>[] },
    req: NcRequest,
  ): Promise<Model> {
    const { title, table_name } = await this.resolveAvailableTableTitle(
      { ...context, base_id: destBaseId },
      destBaseId,
      spec.title,
    );

    const allColumns = [
      ...spec.columns,
      ...syncSystemFields.map((f) => ({ ...f, readonly: true, system: true })),
    ];

    const model = await this.tablesService.tableCreate(
      { ...context, base_id: destBaseId, socket_id: null },
      {
        baseId: destBaseId,
        table: {
          title,
          table_name,
          columns: allColumns,
        },
        apiVersion: NcApiVersion.V3,
        synced: true,
        operationSource: OperationSource.SYNC,
        user: req.user,
        req,
      },
    );

    const defaultView = await View.getFirstCollaborativeView(context, model.id);
    if (defaultView) {
      await this.viewColumnsService.columnsUpdate(context, {
        viewId: defaultView.id,
        columns: model.columns
          .filter((c) => SYSTEM_REMOTE_TITLES.has(c.title) || isSystemColumn(c))
          .map((c) => ({ id: c.id, show: false })),
        req,
      });
    }

    return model;
  }

  private async assertUniqueTitle(
    context: NcContext,
    title: string,
    excludeId?: string,
  ): Promise<void> {
    const siblings = await TableSync.list(context);
    const dup = siblings.find((s) => s.id !== excludeId && s.title === title);
    if (dup) {
      NcError.get(context).invalidRequestBody(
        `Sync title "${title}" already exists in this base`,
      );
    }
  }

  /** Enqueue a sync job and persist its id on the sync row. If the queue
   *  call throws (e.g. Redis down), flip status to Error so we don't leave
   *  the sync stuck in `Syncing` with no job to drive it. */
  private async enqueueJobOrRevert(
    context: NcContext,
    syncId: string,
    params: { mode: 'full-create' | 'full-resync'; req: NcRequest },
  ): Promise<TableSync> {
    let job;
    try {
      job = await this.nocoJobsService.add(JobTypes.TableSyncRun, {
        context,
        syncId,
        mode: params.mode,
        req: params.req,
      });
    } catch (e) {
      await TableSync.update(context, syncId, {
        status: TableSyncStatus.Error,
        last_error: toUserFacingSyncError(e, context),
        sync_job_id: null,
      });
      throw e;
    }
    return TableSync.update(context, syncId, {
      sync_job_id: `${job.id}`,
    });
  }
}
