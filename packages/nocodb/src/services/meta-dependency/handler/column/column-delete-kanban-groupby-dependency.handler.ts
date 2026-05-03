import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import { parseProp } from 'nocodb-sdk';
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
import { parseMetaProp } from '~/utils/modelUtils';

/**
 * Null `fk_grp_col_id` on every Kanban view that pinned the deleted column as
 * its stack-by field. UI prompts to re-select.
 */
@Injectable()
export class ColumnDeleteKanbanGroupByDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnDeleteKanbanGroupByDependencyHandler.name,
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
      { condition: { fk_grp_col_id: id }, limit: 1 },
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
      { condition: { fk_grp_col_id: id } },
    )) {
      const stackMetaObj = parseProp(v.meta) || {};
      const stackMetaChanged = id in stackMetaObj;
      if (stackMetaChanged) {
        delete stackMetaObj[id];
      }

      await KanbanView.update(
        context,
        v.fk_view_id,
        {
          fk_grp_col_id: null,
          ...(stackMetaChanged ? { meta: stackMetaObj } : {}),
        },
        ncMeta,
      );

      // Frontend reads `meta.groupingFieldColumn` directly from the view's
      // meta JSON (useKanbanViewStore.ts) — it's a snapshot taken when the
      // grouping was configured, not derived from fk_grp_col_id at fetch.
      // Strip it so the kanban UI prompts to re-select instead of grouping
      // by the deleted column.
      const view = await View.get(context, v.fk_view_id, false, ncMeta);
      const viewMeta = parseMetaProp(view) || {};
      if (viewMeta.groupingFieldColumn) {
        delete viewMeta.groupingFieldColumn;
        await View.update(
          context,
          v.fk_view_id,
          { meta: viewMeta },
          false,
          ncMeta,
        );
      }

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
      await view.getView(context, Noco.ncMeta);
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: { action: 'view_update', payload: view },
      });
    }
  }
}
