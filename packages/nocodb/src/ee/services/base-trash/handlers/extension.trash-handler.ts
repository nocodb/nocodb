import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { checkLimit } from '~/helpers/paymentHelpers';
import { Extension } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ExtensionTrashHandler extends BaseTrashHandler<Extension> {
  resourceType = 'extension';

  async checkRestoreLimit(
    ctx: NcContext,
    _trashEntry: BaseTrash,
  ): Promise<void> {
    await checkLimit({
      workspaceId: ctx.workspace_id,
      type: PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE,
      message: ({ limit }) =>
        `Cannot restore — you have reached the limit of ${limit} extensions for your plan. Upgrade to restore this extension.`,
    });
  }

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Extension>> {
    const extension = await Extension.get(ctx, id, false, ncMeta);
    if (!extension) {
      NcError.get(ctx).extensionNotFound(id);
    }

    await Extension.softDelete(ctx, id, true, ncMeta);

    return { entity: extension };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.name) {
      const list = await Extension.list(ctx, ctx.base_id, false, ncMeta);
      const existingNames = list.map((e) => e.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await Extension.update(
          ctx,
          trashEntry.resource_id,
          { title: newTitle },
          ncMeta,
        );
      }
    }

    await Extension.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'extension_restore',
        payload: await Extension.get(
          ctx,
          trashEntry.resource_id,
          false,
          ncMeta,
        ),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    await Extension.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Extension.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
