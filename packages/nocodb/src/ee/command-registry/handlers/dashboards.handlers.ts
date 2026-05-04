import {
  DashboardCreateContract,
  DashboardDeleteContract,
  DashboardUpdateContract,
  DuplicateWidgetContract,
  WidgetCreateContract,
  WidgetDeleteContract,
  WidgetUpdateContract,
} from '../operations/dashboards.operations';
import type { DashboardsService } from '~/services/dashboards.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerDashboardHandlers(
  svc: DashboardsService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    DashboardCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'dashboard',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(ctx, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.dashboardCreate(ctx, { ...params, req } as any);
    },
  );

  registerForward(DashboardUpdateContract, (ctx, p) =>
    svc.dashboardUpdate(ctx, p),
  );
  registerForward(DashboardDeleteContract, (ctx, p) =>
    svc.dashboardDelete(ctx, p),
  );

  OperationRegistry.register(
    WidgetCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'widget',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(ctx, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.widgetCreate(ctx, { ...params, req } as any);
    },
  );

  // duplicateWidget creates a new widget whose ID isn't carried in params (only
  // the source widgetId is). Replay must thread the changelog entity_id through
  // so the master-side duplicate ends up with the same ID as the sandbox-side
  // duplicate — otherwise downstream references diverge between bases.
  OperationRegistry.register(DuplicateWidgetContract, async (ctx, p, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    if (ctx.additionalContext?.is_replay && meta.entityId) {
      const trashEntry = await BaseTrash.getByResourceId(
        ctx,
        'widget',
        meta.entityId,
      );
      if (trashEntry?.id) {
        await baseTrashSvc.restore(ctx, {
          trashId: trashEntry.id,
          user: req.user,
          req,
        });
        return { id: meta.entityId };
      }
    }
    return svc.duplicateWidget(ctx, {
      ...p,
      req,
      ...(meta.entityId ? { _replayWidgetId: meta.entityId } : {}),
    } as any);
  });

  registerForward(WidgetUpdateContract, (ctx, p) => svc.widgetUpdate(ctx, p));
  registerForward(WidgetDeleteContract, (ctx, p) => svc.widgetDelete(ctx, p));
}
