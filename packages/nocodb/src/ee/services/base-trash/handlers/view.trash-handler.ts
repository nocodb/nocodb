import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import Model from '~/models/Model';
import View from '~/models/View';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';
import Noco from '~/Noco';
import { getLimit } from '~/helpers/paymentHelpers';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ViewTrashHandler extends BaseTrashHandler<View> {
  resourceType = 'view';
  affectedCaches = ['commandPalette', 'baseSchema'] as const;

  async checkRestoreLimit(
    ctx: NcContext,
    trashEntry: BaseTrash,
  ): Promise<void> {
    if (!trashEntry.parent_id) return;

    const current = await Noco.ncMeta.metaCount(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.VIEWS,
      {
        condition: { fk_model_id: trashEntry.parent_id },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit, plan } = await getLimit(
      PlanLimitTypes.LIMIT_VIEW_PER_TABLE,
      ctx.workspace_id,
    );

    if (limit !== Infinity && current >= limit) {
      NcError.planLimitExceeded(
        `Cannot restore — you have reached the limit of ${limit} views for your plan. Upgrade to restore this view.`,
        { plan: plan?.title, limit, current },
      );
    }
  }

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: any,
  ): Promise<TrashResult<View>> {
    const view = await View.get(ctx, id, false, ncMeta);
    if (!view) {
      NcError.get(ctx).genericNotFound('view', id);
    }

    const table = await Model.getByIdOrName(
      ctx,
      { id: view.fk_model_id },
      ncMeta,
    );

    const builder = await new ViewWebhookManagerBuilder(
      ctx,
      ncMeta,
    ).withModelId(view.fk_model_id);
    const viewWebhookManager = (await builder.withViewId(view.id)).forDelete();

    await View.softDelete(ctx, id, true, ncMeta);

    const meta: Record<string, any> = {};
    if (view.type != null) meta.viewType = view.type;
    if (view.meta != null) meta.viewMeta = view.meta;

    viewWebhookManager.emit();

    return {
      entity: view,
      meta: Object.keys(meta).length ? meta : undefined,
      parentType: 'table',
      parentId: view.fk_model_id,
      parentName: table?.title,
    };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.parent_id) {
      const table = await Model.get(ctx, trashEntry.parent_id, false, ncMeta);
      if (!table) {
        NcError.get(ctx).parentInTrash('table');
      }
    }

    const viewWebhookManager = (
      await new ViewWebhookManagerBuilder(ctx, ncMeta).withModelId(
        trashEntry.parent_id,
      )
    ).forCreate();

    if (trashEntry.name && trashEntry.parent_id) {
      const views = await View.list(ctx, trashEntry.parent_id, false, ncMeta);
      const existingNames = views.map((v) => v.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await View.update(
          ctx,
          trashEntry.resource_id,
          { title: newTitle },
          false,
          ncMeta,
        );
      }
    }

    await View.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.META_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'view_restore',
        payload: await View.get(ctx, trashEntry.resource_id, false, ncMeta),
      } as Record<string, unknown>,
    } as Parameters<typeof NocoSocket.broadcastEvent>[1]);

    (await viewWebhookManager.withNewViewId(trashEntry.resource_id)).emit();
  }

  async permanentDelete(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    await View.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await View.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
