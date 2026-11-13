import { Injectable, Logger } from '@nestjs/common';
import { EventType, kanbanSummaryToView, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { KanbanView, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { viewForBroadcast } from '~/helpers/publicViewSecrets';

/**
 * Clear the whole stack summary of every Kanban view that summarized the
 * deleted field — its label and colour thresholds were set for that field's
 * values, so the stacks fall back to the plain record count.
 */
@Injectable()
export class ColumnDeleteKanbanSummaryDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnDeleteKanbanSummaryDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_summary_col_id: id }, limit: 1 },
    );
    return rows.length ? {} : undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const id = param.oldEntity?.id;
    if (!id) return;

    const affectedViewIds = new Set<string>();

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_summary_col_id: id } },
    )) {
      await KanbanView.update(
        context,
        v.fk_view_id,
        kanbanSummaryToView(null),
        ncMeta,
      );
      affectedViewIds.add(v.fk_view_id);
    }

    this.broadcastViewUpdates(context, affectedViewIds).catch((e) =>
      this.logger.error(
        `Failed to broadcast view_update events: ${e?.message}`,
        e?.stack,
      ),
    );
  }

  private async broadcastViewUpdates(
    context: NcContext,
    viewIds: Set<string>,
  ): Promise<void> {
    for (const viewId of viewIds) {
      const view = await View.get(context, viewId, false, Noco.ncMeta);
      if (!view) continue;
      await view.getView(Noco.ncMeta);
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: { action: 'view_update', payload: viewForBroadcast(view) },
      });
    }
  }
}
