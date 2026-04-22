import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashHandler, TrashResult } from '~/services/base-trash/types';
import { Script } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';
import { checkLimit } from '~/helpers/paymentHelpers';

@Injectable()
export class ScriptTrashHandler implements TrashHandler<Script> {
  resourceType = 'script';

  async checkRestoreLimit(
    ctx: NcContext,
    _trashEntry: BaseTrash,
  ): Promise<void> {
    await checkLimit({
      workspaceId: ctx.workspace_id,
      type: PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE,
      message: ({ limit }) =>
        `Cannot restore — you have reached the limit of ${limit} scripts for your plan. Upgrade to restore this script.`,
    });
  }

  async trash(
    ctx: NcContext,
    id: string,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Script>> {
    const script = await Script.get(ctx, id, false, ncMeta);
    if (!script) {
      NcError.get(ctx).scriptNotFound(id);
    }

    await Script.softDelete(ctx, id, true, ncMeta);

    return { entity: script };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.name) {
      const list = await Script.list(ctx, ctx.base_id, false, ncMeta);
      const existingNames = list.map((s) => s.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await Script.update(
          ctx,
          trashEntry.resource_id,
          { title: newTitle },
          ncMeta,
        );
      }
    }

    await Script.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.SCRIPT_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Script.get(ctx, trashEntry.resource_id, false, ncMeta),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    await Script.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Script.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
