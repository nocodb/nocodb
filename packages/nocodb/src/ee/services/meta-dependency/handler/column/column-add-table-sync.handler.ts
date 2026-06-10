import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType, TableSyncMappingRole } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Model, TableSync } from '~/models';
import TableSyncMapping from '~/models/TableSyncMapping';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TableSyncService } from '~/modules/table-sync/table-sync.service';
import NocoSocket from '~/socket/NocoSocket';
import {
  buildSyncServiceReq,
  scheduleReactiveResync,
} from '~/services/meta-dependency/handler/table-sync-handler.helpers';

/** Reacts to source-side `COLUMN_ADDED`. Only acts on sync-all syncs
 *  (`selected_fields === null`) — specific-fields syncs are user-managed
 *  and shouldn't auto-add. Calls `reconcileFields` (which materialises
 *  the new dest column + inserts a column-mapping row), broadcasts the
 *  dest table_update so clients refetch meta, then debounce-enqueues a
 *  full-resync to backfill historical rows. */
@Injectable()
export class ColumnAddTableSyncHandler implements MetaEventHandler {
  private logger = new Logger(ColumnAddTableSyncHandler.name);

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_ADDED];

  constructor(
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly tableSyncService: TableSyncService,
  ) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<AffectedDependencyResult | undefined> {
    const col = param.newEntity ?? param.oldEntity;
    const fk_model_id = col?.fk_model_id;
    if (!fk_model_id) return undefined;

    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      fk_model_id,
    );
    if (!mappings.length) return undefined;

    return { columns: [col] };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
  ): Promise<void> {
    void this.doWork(context, param).catch((e) => {
      this.logger.error(
        `column-added → table-sync reaction failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    });
  }

  private async doWork(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<void> {
    const col = param.newEntity ?? param.oldEntity;
    const fk_model_id = col?.fk_model_id;
    if (!fk_model_id) return;

    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      fk_model_id,
    );
    if (!mappings.length) return;

    const seenSyncs = new Set<string>();
    for (const mapping of mappings) {
      if (mapping.role !== TableSyncMappingRole.Main) continue;
      if (seenSyncs.has(mapping.fk_table_sync_id)) continue;
      seenSyncs.add(mapping.fk_table_sync_id);

      const destContext: NcContext = {
        workspace_id: mapping.fk_workspace_id,
        base_id: mapping.dest_base_id,
      };

      const sync = await TableSync.get(destContext, mapping.fk_table_sync_id);
      if (!sync) continue;
      if (sync.selected_fields !== null) continue;

      let added = false;
      try {
        const result = await this.tableSyncService.reconcileFields(
          destContext,
          sync,
          {
            nextSelectedFields: null,
            linkViewByColumn: {},
            dropHiddenInView: false,
            includeColIds: col?.id ? new Set([col.id]) : undefined,
            req: buildSyncServiceReq(destContext),
          },
        );
        added = result.added;
      } catch (e) {
        this.logger.error(
          `reconcileFields failed for sync=${sync.id}: ${(e as Error).message}`,
          (e as Error).stack,
        );
        continue;
      }

      if (!added) continue;

      // Broadcast the dest table_update so clients refetch meta and show
      // the new column without waiting for the resync.
      try {
        const table = await Model.getWithInfo(destContext, {
          id: mapping.dest_table_id,
        });
        if (table) {
          NocoSocket.broadcastEvent(destContext, {
            event: EventType.META_EVENT,
            payload: { action: 'table_update', payload: table },
          });
        }
      } catch (e) {
        this.logger.warn(
          `broadcast failed for sync=${sync.id}: ${(e as Error).message}`,
        );
      }

      await scheduleReactiveResync(
        this.nocoJobsService,
        destContext,
        sync,
      ).catch((e) => {
        this.logger.warn(
          `resync enqueue failed for sync=${sync.id}: ${(e as Error).message}`,
        );
      });
    }
  }
}
