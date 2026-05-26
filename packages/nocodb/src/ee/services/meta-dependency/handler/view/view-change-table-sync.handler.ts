import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType, TableSyncStatus } from 'nocodb-sdk';
import type { NcContext, ViewType } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { TableSync, TableSyncMapping, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/** Freezes table-syncs whose source view just had its sync gate revoked.
 *
 *  Three operator actions count as a revoke, checked in this order:
 *    1. `allow_sync` flipped to false — the explicit "this view can be
 *       mirrored" toggle.
 *    2. `uuid` cleared — public share removed entirely; uuid was a gate
 *       requirement at createSync time.
 *    3. Share password changed (rotated, added, or removed). Each mapping
 *       stores the hash captured at createSync; if it no longer matches
 *       the live hash, the sync's authorization is stale.
 *
 *  All three must take effect immediately. The processor also re-verifies
 *  on every run, but that only catches the next sync attempt — this
 *  reactive path closes the gap so an idle sync doesn't stay Active
 *  indefinitely after the source revokes.
 *
 *  Password rotation is invisible in the event payload (the bcrypt hash
 *  is masked to a sentinel before emit), so we always re-fetch the live
 *  view here and compare against each mapping's stored hash. */
@Injectable()
export class ViewChangeTableSyncHandler implements MetaEventHandler {
  private logger = new Logger(ViewChangeTableSyncHandler.name);

  triggerMetaEvents: MetaEventType[] = [
    MetaEventType.VIEW_UPDATED,
    MetaEventType.VIEW_DELETED,
  ];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const view = (param.newEntity ?? param.oldEntity) as ViewType | undefined;
    if (!view?.id) return undefined;
    const mappings = await TableSyncMapping.listBySourceView(
      context.workspace_id,
      context.base_id,
      view.id,
      ncMeta,
    );
    if (!mappings.length) return undefined;
    return { views: [view] };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
  ): Promise<void> {
    void this.doWork(context, param).catch((e) => {
      this.logger.error(
        `view → table-sync reaction failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    });
  }

  private async doWork(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<void> {
    const isDelete = param.eventType === MetaEventType.VIEW_DELETED;
    const view = (param.newEntity ?? param.oldEntity) as ViewType;
    if (!view?.id) return;

    const mappings = await TableSyncMapping.listBySourceView(
      context.workspace_id,
      context.base_id,
      view.id,
    );
    if (!mappings.length) return;

    const liveView = isDelete ? null : await View.get(context, view.id);
    if (!isDelete && !liveView) return;

    const seen = new Set<string>();
    for (const mapping of mappings) {
      if (seen.has(mapping.fk_table_sync_id)) continue;
      seen.add(mapping.fk_table_sync_id);

      let reason: string | null = null;
      if (isDelete) {
        reason = `Source view "${
          view.title || view.id
        }" was deleted`;
      } else if (liveView) {
        if (!liveView.allow_sync) {
          reason = `Source view "${
            liveView.title || liveView.id
          }" had "Allow sync" disabled`;
        } else if (!liveView.uuid) {
          reason = `Source view "${
            liveView.title || liveView.id
          }" is no longer publicly shared`;
        } else if (
          (liveView.password ?? null) !==
          (mapping.source_password_hash ?? null)
        ) {
          reason = `Source view "${
            liveView.title || liveView.id
          }" share password has changed`;
        }
      }
      if (!reason) continue;

      const destContext: NcContext = {
        workspace_id: mapping.fk_workspace_id,
        base_id: mapping.dest_base_id,
      };

      const sync = await TableSync.get(destContext, mapping.fk_table_sync_id);
      if (!sync || sync.status === TableSyncStatus.Error) continue;

      const updated = await TableSync.update(
        destContext,
        mapping.fk_table_sync_id,
        {
          status: TableSyncStatus.Error,
          last_error: `${reason} — sync stopped`,
          sync_job_id: null,
        },
      );

      NocoSocket.broadcastEvent(destContext, {
        event: EventType.META_EVENT,
        payload: {
          action: 'table_sync_update',
          payload: { ...updated, base_id: destContext.base_id },
        },
      });
    }
  }
}
