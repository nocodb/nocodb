import { Injectable } from '@nestjs/common';
import { DependencyTableType, EventType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { Dashboard, DependencyTracker, Widget } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class WidgetTrashHandler extends BaseTrashHandler<Widget> {
  resourceType = 'widget';

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Widget>> {
    const widget = await Widget.get(ctx, id, false, ncMeta);
    if (!widget) {
      NcError.get(ctx).widgetNotFound(id);
    }

    const dashboard = await Dashboard.get(
      ctx,
      widget.fk_dashboard_id,
      false,
      ncMeta,
    );

    await Widget.softDelete(ctx, id, true, ncMeta);

    return {
      entity: widget,
      parentType: 'dashboard',
      parentId: widget.fk_dashboard_id,
      parentName: dashboard?.title,
    };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.parent_id) {
      const dashboard = await Dashboard.get(
        ctx,
        trashEntry.parent_id,
        false,
        ncMeta,
      );
      if (!dashboard) {
        NcError.get(ctx).parentInTrash('dashboard');
      }
    }

    await Widget.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.WIDGET_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Widget.get(ctx, trashEntry.resource_id, false, ncMeta),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    await DependencyTracker.clearDependencies(
      ctx,
      DependencyTableType.Widget,
      trashEntry.resource_id,
      ncMeta,
    );
    await Widget.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Widget.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
