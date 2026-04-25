import { Injectable } from '@nestjs/common';
import { EventType, generateUniqueCopyName, PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type BaseTrash from '~/models/BaseTrash';
import type { MetaService } from '~/meta/meta.service';
import type { TrashCallParam, TrashResult } from '~/services/base-trash/types';
import { BaseTrashHandler } from '~/services/base-trash/types';
import { Dashboard } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/catchError';
import { checkLimit } from '~/helpers/paymentHelpers';

@Injectable()
export class DashboardTrashHandler extends BaseTrashHandler<Dashboard> {
  resourceType = 'dashboard';
  childTypes = ['widget'];
  affectedCaches = ['commandPalette'] as const;

  async checkRestoreLimit(
    ctx: NcContext,
    _trashEntry: BaseTrash,
  ): Promise<void> {
    await checkLimit({
      workspaceId: ctx.workspace_id,
      type: PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      message: ({ limit }) =>
        `Cannot restore — you have reached the limit of ${limit} dashboards for your plan. Upgrade to restore this dashboard.`,
    });
  }

  async trash(
    ctx: NcContext,
    id: string,
    _param: TrashCallParam,
    ncMeta?: MetaService,
  ): Promise<TrashResult<Dashboard>> {
    const dashboard = await Dashboard.get(ctx, id, false, ncMeta);
    if (!dashboard) {
      NcError.get(ctx).dashboardNotFound(id);
    }

    await Dashboard.softDelete(ctx, id, true, ncMeta);

    return { entity: dashboard };
  }

  async restore(
    ctx: NcContext,
    trashEntry: BaseTrash,
    ncMeta?: MetaService,
  ): Promise<void> {
    if (trashEntry.name) {
      const list = await Dashboard.list(ctx, ctx.base_id, false, ncMeta);
      const existingNames = list.map((d) => d.title);
      if (existingNames.includes(trashEntry.name)) {
        const newTitle = generateUniqueCopyName(
          trashEntry.name,
          existingNames,
          {
            prefix: 'Restored',
          },
        );
        await Dashboard.update(
          ctx,
          trashEntry.resource_id,
          { title: newTitle },
          ncMeta,
        );
      }
    }

    await Dashboard.softDelete(ctx, trashEntry.resource_id, false, ncMeta);

    NocoSocket.broadcastEvent(ctx, {
      event: EventType.DASHBOARD_EVENT,
      payload: {
        id: trashEntry.resource_id,
        action: 'restore',
        payload: await Dashboard.get(
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
    await Dashboard.softDelete(ctx, trashEntry.resource_id, false, ncMeta);
    await Dashboard.delete(ctx, trashEntry.resource_id, ncMeta);
  }
}
