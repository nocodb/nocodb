import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import { Script } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ScriptTrashHandler implements TrashHandler<Script> {
  resourceType = 'script';

  async trash(ctx: NcContext, id: string): Promise<TrashResult<Script>> {
    const script = await Script.get(ctx, id);
    if (!script) {
      NcError.get(ctx).scriptNotFound(id);
    }

    await Script.softDelete(ctx, id, true);

    return { entity: script };
  }

  async restore(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    if (trashEntry.name) {
      const list = await Script.list(ctx, ctx.base_id);
      const existingNames = list.map((s) => s.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(trashEntry.name, existingNames, {
          prefix: 'Restored',
        });
        await Script.update(ctx, trashEntry.resource_id, {
          title: newTitle,
        });
      }
    }

    await Script.softDelete(ctx, trashEntry.resource_id, false);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.SCRIPT_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Script.get(ctx, trashEntry.resource_id),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(ctx: NcContext, trashEntry: BaseTrash): Promise<void> {
    await Script.softDelete(ctx, trashEntry.resource_id, false);
    await Script.delete(ctx, trashEntry.resource_id);
  }
}
