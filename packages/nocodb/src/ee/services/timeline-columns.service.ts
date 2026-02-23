import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { MetaTable } from '~/cli';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Column, View } from '~/models';
import TimelineViewColumn from '~/models/TimelineViewColumn';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class TimelineColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async timelineColumnUpdate(
    context: NcContext,
    param: {
      timelineViewColumnId: string;
      timeline: GridColumnReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.timeline,
    );

    const oldTimelineViewColumn = await TimelineViewColumn.get(
      context,
      param.timelineViewColumnId,
      ncMeta,
    );

    const column = await Column.get(
      context,
      {
        colId: oldTimelineViewColumn.fk_column_id,
      },
      ncMeta,
    );

    const view = await View.get(
      context,
      oldTimelineViewColumn.fk_view_id,
      ncMeta,
    );

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await TimelineViewColumn.update(
      context,
      param.timelineViewColumnId,
      param.timeline,
      ncMeta,
    );

    const viewColumn = extractProps(param.timeline, [
      'order',
      'show',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'aggregation',
    ]);

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldTimelineViewColumn,
      viewColumn,
      column,
      view,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_update',
          payload: {
            ...oldTimelineViewColumn,
            ...viewColumn,
          },
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return res;
  }

  async timelineColumnClearGroupBy(
    context: NcContext,
    param: { viewId: string; viewWebhookManager?: ViewWebhookManager },
    ncMeta = Noco.ncMeta,
  ) {
    const qb = ncMeta
      .knex(MetaTable.TIMELINE_VIEW_COLUMNS)
      .where('base_id', '=', context.base_id)
      .andWhere('fk_view_id', '=', param.viewId)
      .update({
        group_by: null,
        group_by_order: null,
        group_by_sort: null,
        aggregation: 'none',
      });
    if (context.workspace_id) {
      qb.andWhere('fk_workspace_id', '=', context.workspace_id);
    }

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      const view = await View.get(context, param.viewId, ncMeta);
      viewWebhookManager =
        param.viewWebhookManager ??
        (
          await (
            await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
              view.fk_model_id,
            )
          ).withViewId(view.id)
        ).forUpdate();
    }

    await NocoCache.deepDel(
      context,
      `${CacheScope.TIMELINE_VIEW_COLUMN}:${param.viewId}`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
    const result = await qb;
    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
    return result;
  }
}
