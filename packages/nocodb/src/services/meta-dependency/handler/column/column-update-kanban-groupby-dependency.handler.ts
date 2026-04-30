import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType, parseProp, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Column, KanbanView, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

const UNCATEGORIZED_STACK = {
  id: 'uncategorized',
  title: null,
  order: 0,
  color: '#6A7184',
  collapsed: false,
} as const;

/**
 * Kanban "stack-by" sync on a SingleSelect column update.
 *  - Column stays SingleSelect: refresh `meta.groupingFieldColumn` on every
 *    Kanban view stacked-by it; rebuild stack metadata to track the current
 *    options (preserve order/collapsed for existing options, append new ones).
 *  - Column type leaves SingleSelect: clear `meta.groupingFieldColumn` and
 *    drop the stack metadata for that column.
 *
 * Broadcasts `view_update` per affected view so other clients pick up the
 * new stack layout without a full refetch.
 */
@Injectable()
export class ColumnUpdateKanbanGroupByDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateKanbanGroupByDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    // Was the column a SingleSelect (the only kanban-groupable type)?
    if (oldCol.uidt !== UITypes.SingleSelect) return undefined;

    // Probe — is anything actually grouped by this column?
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_grp_col_id: oldCol.id }, limit: 1 },
    );
    if (!rows.length) return undefined;
    return {};
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity as Column;
    const newCol = param.newEntity as Column;
    if (!oldCol?.id || !newCol?.id) return;

    const kanbanViews =
      (await KanbanView.getViewsByGroupingColId(context, oldCol.id, ncMeta)) ||
      [];
    if (!kanbanViews.length) return;

    // Hydrate options on the new column for stack metadata refresh.
    const stillSingleSelect = newCol.uidt === UITypes.SingleSelect;
    let newOptions: Array<any> | undefined;
    if (stillSingleSelect) {
      const newColFull = await Column.get(
        context,
        { colId: newCol.id },
        ncMeta,
      );
      const opts = await newColFull.getColOptions<any>(context, ncMeta);
      newOptions = opts?.options ?? [];
    }

    const affectedViewIds = new Set<string>();

    for (const kanbanView of kanbanViews) {
      const view = await View.get(
        context,
        kanbanView.fk_view_id,
        false,
        ncMeta,
      );
      // Skip orphaned kanban entries whose parent view was deleted concurrently
      if (!view) continue;
      view.meta = parseMetaProp(view);

      if (stillSingleSelect) {
        await View.update(
          context,
          view.id,
          {
            ...view,
            meta: { ...view.meta, groupingFieldColumn: newCol },
          },
          false,
          ncMeta,
        );

        if (newOptions) {
          const stackMetaObj = parseProp(kanbanView.meta) || {};
          const existingStacks: any[] = stackMetaObj[oldCol.id] || [];

          const existingUncategorized = existingStacks.find(
            (s) => s.id === 'uncategorized',
          );
          const newStackMeta: any[] = [
            existingUncategorized || { ...UNCATEGORIZED_STACK },
          ];

          for (const option of newOptions) {
            const existing = existingStacks.find((s) => s.id === option.id);
            if (existing) {
              newStackMeta.push({
                ...option,
                order: existing.order,
                collapsed: existing.collapsed || false,
              });
            } else {
              const maxOrder = Math.max(
                ...existingStacks.map((s) => s.order || 0),
                0,
              );
              newStackMeta.push({
                ...option,
                order: maxOrder + 1,
                collapsed: false,
              });
            }
          }
          newStackMeta.sort((a, b) => (a.order || 0) - (b.order || 0));

          stackMetaObj[oldCol.id] = newStackMeta;
          await KanbanView.update(
            context,
            kanbanView.fk_view_id,
            { meta: stackMetaObj },
            ncMeta,
          );
        }
      } else {
        await View.update(
          context,
          view.id,
          {
            ...view,
            meta: { ...view.meta, groupingFieldColumn: null },
          },
          false,
          ncMeta,
        );

        const stackMetaObj = parseProp(kanbanView.meta) || {};
        delete stackMetaObj[oldCol.id];
        await KanbanView.update(
          context,
          kanbanView.fk_view_id,
          { meta: stackMetaObj },
          ncMeta,
        );
      }

      affectedViewIds.add(view.id);
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
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: { action: 'view_update', payload: view },
        },
        context.socket_id,
      );
    }
  }
}
