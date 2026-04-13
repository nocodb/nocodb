import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '../types';
import Model from '~/models/Model';
import View from '~/models/View';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ViewTrashHandler implements TrashHandler<View> {
  resourceType = 'view';

  async trash(ctx: NcContext, id: string): Promise<TrashResult<View>> {
    const view = await View.get(ctx, id);
    if (!view) {
      NcError.get(ctx).genericNotFound('view', id);
    }

    const table = await Model.getByIdOrName(ctx, { id: view.fk_model_id });

    await View.softDelete(ctx, id, true);

    const meta: Record<string, any> = {};
    if (view.type != null) meta.viewType = view.type;
    if (view.meta != null) meta.viewMeta = view.meta;

    return {
      entity: view,
      meta: Object.keys(meta).length ? meta : undefined,
      parentType: 'table',
      parentId: view.fk_model_id,
      parentName: table?.title,
    };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.parent_id) {
      const table = await Model.get(ctx, trashEntry.parent_id);
      if (!table) {
        NcError.get(ctx).parentInTrash('table');
      }
    }

    if (trashEntry.name && trashEntry.parent_id) {
      const views = await View.list(ctx, trashEntry.parent_id);
      const existingNames = views.map((v) => v.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(trashEntry.name, existingNames);
        await View.update(ctx, trashEntry.resource_id, { title: newTitle });
      }
    }

    await View.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'view_restore',
        payload: await View.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await View.softDelete(ctx, trashEntry.resource_id, false);
    await View.delete(ctx, trashEntry.resource_id);
  }
}
