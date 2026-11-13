import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  isKanbanSummaryFnValid,
  kanbanSummarySupportsColors,
  kanbanSummaryToView,
  MetaEventType,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Column, KanbanView, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { viewForBroadcast } from '~/helpers/publicViewSecrets';

/**
 * Re-check Kanban stack summaries on the updated field. Any edit can change
 * what a formula, rollup or lookup returns, not only a type change:
 *  - function no longer supported → clear the whole summary
 *  - result became a date → drop the colour rules (they compare numbers)
 */
@Injectable()
export class ColumnUpdateKanbanSummaryDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateKanbanSummaryDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.newEntity?.id ?? param.oldEntity?.id;
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
    const id = param.newEntity?.id ?? param.oldEntity?.id;
    if (!id) return;

    const column = await Column.get(context, { colId: id }, ncMeta);
    if (column) column.colOptions = await column.getColOptions(ncMeta);

    const affectedViewIds = new Set<string>();

    for (const row of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_summary_col_id: id } },
    )) {
      if (!column || !isKanbanSummaryFnValid(row.summary_fn, column)) {
        await KanbanView.update(
          context,
          row.fk_view_id,
          kanbanSummaryToView(null),
          ncMeta,
        );
      } else if (
        row.summary_colors &&
        !kanbanSummarySupportsColors(row.summary_fn, column)
      ) {
        await KanbanView.update(
          context,
          row.fk_view_id,
          { summary_colors: null },
          ncMeta,
        );
      } else {
        continue;
      }
      affectedViewIds.add(row.fk_view_id);
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
