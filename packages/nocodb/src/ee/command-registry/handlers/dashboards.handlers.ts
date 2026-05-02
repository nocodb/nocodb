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
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerDashboardHandlers(svc: DashboardsService): void {
  registerForward(DashboardCreateContract, (ctx, p) =>
    svc.dashboardCreate(ctx, p),
  );
  registerForward(DashboardUpdateContract, (ctx, p) =>
    svc.dashboardUpdate(ctx, p),
  );
  registerForward(DashboardDeleteContract, (ctx, p) =>
    svc.dashboardDelete(ctx, p),
  );
  registerForward(WidgetCreateContract, (ctx, p) => svc.widgetCreate(ctx, p));

  // duplicateWidget creates a new widget whose ID isn't carried in params (only
  // the source widgetId is). Replay must thread the changelog entity_id through
  // so the master-side duplicate ends up with the same ID as the sandbox-side
  // duplicate — otherwise downstream references diverge between bases.
  OperationRegistry.register(DuplicateWidgetContract, async (ctx, p, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    return svc.duplicateWidget(ctx, {
      ...p,
      req,
      ...(meta.entityId ? { _replayWidgetId: meta.entityId } : {}),
    } as any);
  });

  registerForward(WidgetUpdateContract, (ctx, p) => svc.widgetUpdate(ctx, p));
  registerForward(WidgetDeleteContract, (ctx, p) => svc.widgetDelete(ctx, p));
}
