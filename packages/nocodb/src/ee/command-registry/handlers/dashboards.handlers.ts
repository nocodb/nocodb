import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  DashboardCreateContract,
  DashboardUpdateContract,
  DashboardDeleteContract,
  WidgetCreateContract,
  DuplicateWidgetContract,
  WidgetUpdateContract,
  WidgetDeleteContract,
} from '../operations/dashboards.operations';
import type { DashboardsService } from 'src/ee/services/dashboards.service';

export function registerDashboardHandlers(svc: DashboardsService): void {
  OperationRegistry.register(
    DashboardCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.dashboardCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    DashboardUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.dashboardUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    DashboardDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.dashboardDelete(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WidgetCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.widgetCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    DuplicateWidgetContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.duplicateWidget(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WidgetUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.widgetUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WidgetDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.widgetDelete(ctx, { ...params, req } as any);
    },
  );
}
