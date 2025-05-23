import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import Dashboard from '~/models/Dashboard';
import Widget from '~/models/Widget';

@Injectable()
export class DashboardsService {
  async dashboardList(context: NcContext, baseId: string) {
    return await Dashboard.list(context, baseId);
  }

  async dashboardGet(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);
    if (dashboard) {
      await dashboard.getWidgets(context);
    }
    return dashboard;
  }

  async dashboardCreate(
    context: NcContext,
    dashboard: Partial<Dashboard>,
    req: NcRequest,
  ) {
    if (!dashboard.created_by) {
      dashboard.created_by = req.user?.id;
    }
    if (!dashboard.owned_by) {
      dashboard.owned_by = req.user?.id;
    }
    return await Dashboard.insert(context, dashboard);
  }

  async dashboardUpdate(
    context: NcContext,
    dashboardId: string,
    dashboard: Partial<Dashboard>,
  ) {
    return await Dashboard.update(context, dashboardId, dashboard);
  }

  async dashboardDelete(context: NcContext, dashboardId: string) {
    return await Dashboard.delete(context, dashboardId);
  }

  async widgetList(context: NcContext, dashboardId: string) {
    return await Widget.list(context, dashboardId);
  }

  async widgetGet(context: NcContext, widgetId: string) {
    return await Widget.get(context, widgetId);
  }

  async widgetCreate(context: NcContext, widget: Partial<Widget>) {
    return await Widget.insert(context, widget);
  }

  async widgetUpdate(
    context: NcContext,
    widgetId: string,
    widget: Partial<Widget>,
  ) {
    return await Widget.update(context, widgetId, widget);
  }

  async widgetDelete(context: NcContext, widgetId: string) {
    return await Widget.delete(context, widgetId);
  }
}
