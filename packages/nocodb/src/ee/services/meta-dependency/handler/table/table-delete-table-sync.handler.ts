import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  MetaEventType,
  TableSyncMappingRole,
  TableSyncStatus,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import {
  Column,
  Model,
  TableSync,
  TableSyncColumnMapping,
  TableSyncMapping,
} from '~/models';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';
import { buildSyncServiceReq } from '~/services/meta-dependency/handler/table-sync-handler.helpers';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/** Reacts to source-side `TABLE_DELETED`. Two branches:
 *
 *  - Source table is a sync's **Main** source → flip the sync to `Error`.
 *    The dest schema is structurally tied to the source main table; we
 *    can't repair, so we surface the broken state and let the user choose
 *    to delete the sync (with the convert / drop choice in the UI).
 *
 *  - Source table is a sync's **LinkedShadow** source (the linked-side of
 *    an LTAR) → soft fallback. The main sync is otherwise fine; only this
 *    one relation is dead. So:
 *      1. Drop every LTAR on the main dest that references the dead
 *         shadow (via `removeSyncedField`, which cascades junction +
 *         column-mappings).
 *      2. Convert the shadow itself: `Model.updateSynced(false)`, flip
 *         every `readonly=true` col to `readonly=false`, drop the
 *         column-mappings + the `LinkedShadow` mapping row.
 *      3. Sync stays `Active` — the rest of the dest keeps mirroring.
 *
 *  Error isolation: handler returns immediately; the work is a detached
 *  `doWork()` promise. Failures log and die in `.catch()` — they cannot
 *  bubble up and fail the source-side table-delete operation. */
@Injectable()
export class TableDeleteTableSyncHandler implements MetaEventHandler {
  private logger = new Logger(TableDeleteTableSyncHandler.name);

  triggerMetaEvents: MetaEventType[] = [MetaEventType.TABLE_DELETED];

  constructor(protected readonly tableSyncService: TableSyncService) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const table = param.oldEntity;
    if (!table?.id) return undefined;
    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      table.id,
      ncMeta,
    );
    if (!mappings.length) return undefined;
    return { models: [table] };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
  ): Promise<void> {
    void this.doWork(context, param).catch((e) => {
      this.logger.error(
        `table-delete → table-sync reaction failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    });
  }

  private async doWork(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<void> {
    const table = param.oldEntity;
    if (!table?.id) return;

    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      table.id,
    );
    if (!mappings.length) return;

    for (const mapping of mappings) {
      try {
        if (mapping.role === TableSyncMappingRole.Main) {
          await this.flipSyncToError(mapping, table);
        } else if (mapping.role === TableSyncMappingRole.LinkedShadow) {
          await this.unsyncShadow(mapping, table);
        }
      } catch (e) {
        this.logger.error(
          `Reaction failed for mapping=${mapping.id} role=${mapping.role}: ${
            (e as Error).message
          }`,
          (e as Error).stack,
        );
      }
    }
  }

  /** Main source table gone — flip to Error with a reason the UI surfaces. */
  private async flipSyncToError(
    mapping: TableSyncMapping,
    sourceTable: { title?: string; id?: string },
  ): Promise<void> {
    const destContext: NcContext = {
      workspace_id: mapping.fk_workspace_id,
      base_id: mapping.dest_base_id,
    };
    const sync = await TableSync.get(destContext, mapping.fk_table_sync_id);
    if (!sync) return;
    if (sync.status === TableSyncStatus.Error) return;

    const reason = `Source table "${
      sourceTable.title || sourceTable.id
    }" was deleted — sync stopped`;

    const updated = await TableSync.update(destContext, sync.id, {
      status: TableSyncStatus.Error,
      last_error: reason,
      sync_job_id: null,
    });

    NocoSocket.broadcastEvent(destContext, {
      event: EventType.META_EVENT,
      payload: {
        action: 'table_sync_update',
        payload: { ...updated, base_id: destContext.base_id },
      },
    });
  }

  /** Linked source table gone — drop the LTAR(s) + junction(s) on the main
   *  dest, unsync the shadow, drop the shadow's column-mappings + the
   *  LinkedShadow mapping row. Sync stays Active. */
  private async unsyncShadow(
    mapping: TableSyncMapping,
    sourceTable: { title?: string; id?: string },
  ): Promise<void> {
    const destContext: NcContext = {
      workspace_id: mapping.fk_workspace_id,
      base_id: mapping.dest_base_id,
    };
    const sync = await TableSync.get(destContext, mapping.fk_table_sync_id);
    if (!sync) return;

    const mainMapping = (sync.mappings ?? []).find(
      (m) => m.role === TableSyncMappingRole.Main,
    );
    if (!mainMapping) return;

    const mainContext: NcContext = {
      workspace_id: mainMapping.fk_workspace_id,
      base_id: mainMapping.dest_base_id,
    };
    const mainDest = await Model.get(mainContext, mainMapping.dest_table_id);
    if (mainDest) {
      await mainDest.getColumns(mainContext);

      // Drop every LTAR on main that points at the dead shadow. Each call
      // cascades the LTAR's junction + this LinkedShadow mapping cleanup
      // via `removeSyncedField` (which is now public on TableSyncService).
      for (const c of mainDest.columns ?? []) {
        if (c.uidt !== UITypes.LinkToAnotherRecord) continue;
        const refId = (c.colOptions as { fk_related_model_id?: string })
          ?.fk_related_model_id;
        if (refId !== mapping.dest_table_id) continue;

        try {
          await this.tableSyncService.removeSyncedField(
            mainContext,
            sync,
            mainDest as Model,
            c as Column,
            buildSyncServiceReq(mainContext),
            // Soft-fallback path: drop the LTAR + junction but KEEP the
            // shadow as a regular (unsynced) table. The shadow conversion
            // is handled below — letting removeSyncedField also drop it
            // would race against `Model.updateSynced(false)` and leave the
            // user with their data gone.
            { keepShadow: true },
          );
        } catch (e) {
          this.logger.warn(
            `unsyncShadow: failed to drop LTAR col ${c.id}: ${
              (e as Error).message
            }`,
          );
        }
      }
    }

    // Convert the shadow itself to a regular table.
    const shadowDest = await Model.get(destContext, mapping.dest_table_id);
    if (shadowDest) {
      try {
        await Model.updateSynced(destContext, mapping.dest_table_id, false);
        await shadowDest.getColumns(destContext);
        for (const col of shadowDest.columns ?? []) {
          if (col.readonly && col.id) {
            await Column.update(destContext, col.id, { readonly: false });
          }
        }

        const refreshed = await Model.getWithInfo(destContext, {
          id: mapping.dest_table_id,
        });
        if (refreshed) {
          NocoSocket.broadcastEvent(destContext, {
            event: EventType.META_EVENT,
            payload: { action: 'table_update', payload: refreshed },
          });
        }
      } catch (e) {
        this.logger.warn(
          `unsyncShadow: failed to convert shadow ${mapping.dest_table_id}: ${
            (e as Error).message
          }`,
        );
      }
    }

    // Drop the column-mappings + the LinkedShadow mapping. `removeSyncedField`
    // above may have already done this if all LTARs referencing this shadow
    // were dropped (ref-count hit zero); but if there were none to drop, the
    // shadow mapping still lingers. Cover both cases idempotently.
    await TableSyncColumnMapping.deleteByTableSyncMapping(
      destContext,
      mapping.id,
    );
    const stillPresent = await TableSyncMapping.get(destContext, mapping.id);
    if (stillPresent) {
      await TableSyncMapping.deleteById(destContext, mapping.id);
    }

    this.logger.log(
      `Linked source "${
        sourceTable.title || sourceTable.id
      }" deleted — shadow ${mapping.dest_table_id} unsynced, sync ${
        sync.id
      } stays Active`,
    );
  }
}
