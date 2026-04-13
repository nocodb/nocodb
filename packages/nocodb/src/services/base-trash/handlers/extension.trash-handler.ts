import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '../types';
import { Extension } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ExtensionTrashHandler implements TrashHandler<Extension> {
  resourceType = 'extension';

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Extension>> {
    const extension = await Extension.get(ctx, id);
    if (!extension) {
      NcError.get(ctx).extensionNotFound(id);
    }

    await Extension.softDelete(ctx, id, true);

    return { entity: extension };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.name) {
      const list = await Extension.list(ctx, ctx.base_id);
      const existingNames = list.map((e) => e.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
        );
        await Extension.update(ctx, trashEntry.resource_id, {
          title: newTitle,
        });
      }
    }

    await Extension.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'extension_restore',
        payload: await Extension.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await Extension.softDelete(ctx, trashEntry.resource_id, false);
    await Extension.delete(ctx, trashEntry.resource_id);
  }
}
