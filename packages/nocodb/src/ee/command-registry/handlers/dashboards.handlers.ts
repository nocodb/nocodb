import { registerForward } from '~/command-registry/_replay-context';
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
  registerForward(DashboardCreateContract, (ctx, p) => svc.dashboardCreate(ctx, p));
  registerForward(DashboardUpdateContract, (ctx, p) => svc.dashboardUpdate(ctx, p));
  registerForward(DashboardDeleteContract, (ctx, p) => svc.dashboardDelete(ctx, p));
  registerForward(WidgetCreateContract, (ctx, p) => svc.widgetCreate(ctx, p));
  registerForward(DuplicateWidgetContract, (ctx, p) => svc.duplicateWidget(ctx, p));
  registerForward(WidgetUpdateContract, (ctx, p) => svc.widgetUpdate(ctx, p));
  registerForward(WidgetDeleteContract, (ctx, p) => svc.widgetDelete(ctx, p));
}
