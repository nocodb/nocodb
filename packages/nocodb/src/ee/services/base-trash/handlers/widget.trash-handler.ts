import { Injectable } from '@nestjs/common';
import { DependencyTableType, EventType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import { Dashboard, DependencyTracker, Widget } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class WidgetTrashHandler implements TrashHandler<Widget> {
  resourceType = 'widget';

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Widget>> {
    const widget = await Widget.get(ctx, id);
    if (!widget) {
      NcError.get(ctx).widgetNotFound(id);
    }

    const dashboard = await Dashboard.get(ctx, (widget as any).fk_dashboard_id);

    await Widget.softDelete(ctx, id, true);

    return {
      entity: widget,
      parentType: 'dashboard',
      parentId: (widget as any).fk_dashboard_id,
      parentName: dashboard?.title,
    };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.parent_id) {
      const dashboard = await Dashboard.get(ctx, trashEntry.parent_id);
      if (!dashboard) {
        NcError.get(ctx).parentInTrash('dashboard');
      }
    }

    await Widget.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.WIDGET_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Widget.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await DependencyTracker.clearDependencies(
      ctx,
      DependencyTableType.Widget,
      trashEntry.resource_id,
    );
    await Widget.softDelete(ctx, trashEntry.resource_id, false);
    await Widget.delete(ctx, trashEntry.resource_id);
  }
}
