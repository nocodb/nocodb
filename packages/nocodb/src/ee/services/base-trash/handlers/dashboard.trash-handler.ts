import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import { Dashboard } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class DashboardTrashHandler implements TrashHandler<Dashboard> {
  resourceType = 'dashboard';
  childTypes = ['widget'];

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Dashboard>> {
    const dashboard = await Dashboard.get(ctx, id);
    if (!dashboard) {
      NcError.get(ctx).dashboardNotFound(id);
    }

    await Dashboard.softDelete(ctx, id, true);

    return { entity: dashboard };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.name) {
      const list = await Dashboard.list(ctx, ctx.base_id);
      const existingNames = list.map((d) => d.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(trashEntry.name, existingNames);
        await Dashboard.update(ctx, trashEntry.resource_id, {
          title: newTitle,
        });
      }
    }

    await Dashboard.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.DASHBOARD_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Dashboard.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await Dashboard.softDelete(ctx, trashEntry.resource_id, false);
    await Dashboard.delete(ctx, trashEntry.resource_id);
  }
}
