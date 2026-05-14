import { Injectable } from '@nestjs/common';
import { EventType, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { Hook, Model } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';
import { checkLimit } from '~/helpers/paymentHelpers';

/**
 * Trash handler for webhooks. A webhook is a child of its table — same
 * parent shape as views / fields / records — so the trash entry is
 * `parent_type: 'table'` and `TableTrashHandler.childTypes` includes 'hook'
 * to cascade-trash all webhooks when their parent table is trashed.
 *
 * Soft-delete sets `nc_hooks_v2.deleted = true`. The webhook stops firing
 * (Hook.list filters it out) but the row + its trigger fields stay until
 * permanent-delete sweeps them via `Hook.delete`.
 */
@Injectable()
export class HookTrashHandler extends BaseTrashHandler<Hook> {
  resourceType = 'hook';
  affectedCaches = [] as const;

  async checkRestoreLimit(
    ctx: NcContext,
    _trashEntry: BaseTrash,
  ): Promise<void> {
    await checkLimit({
      workspaceId: ctx.workspace_id,
      type: PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE,
      message: ({ limit }) =>
        `Cannot restore — you have reached the limit of ${limit} webhooks for your plan. Upgrade to restore this webhook.`,
    });
  }

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Hook>> {
    const hook = await Hook.get(ctx, id, false, ncMeta);
    if (!hook) {
      NcError.get(ctx).hookNotFound(id);
    }

    await Hook.softDelete(ctx, id, true, ncMeta);

    const table = hook.fk_model_id
      ? await Model.get(ctx, hook.fk_model_id, false, ncMeta)
      : null;

    return {
      entity: { ...hook, title: hook.title } as Hook,
      parentType: 'table',
      parentId: hook.fk_model_id,
      parentName: table?.title,
    };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    await Hook.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        action: 'hook_create',
        payload: await Hook.get(ctx, trashEntry.resource_id, false, ncMeta),
      },
    });
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<void> {
    await Hook.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Hook.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
