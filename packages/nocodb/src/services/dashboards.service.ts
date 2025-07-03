import { Injectable } from '@nestjs/common';
import { NcError } from 'src/helpers/ncError';
import { WidgetTypes } from 'nocodb-sdk';
import type { WidgetType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Dashboard from '~/models/Dashboard';
import Widget from '~/models/Widget';
import { getWidgetData } from '~/db/widgets';

@Injectable()
export class DashboardsService {
  async dashboardList(context: NcContext, baseId: string) {
    return await Dashboard.list(context, baseId);
  }

  async dashboardGet(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    await dashboard.getWidgets(context);

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
    updateObj: Partial<Dashboard>,
  ) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    return await Dashboard.update(context, dashboardId, updateObj);
  }

  async dashboardDelete(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    return await Dashboard.delete(context, dashboardId);
  }

  async widgetList(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    return await Widget.list(context, dashboardId);
  }

  async widgetGet(context: NcContext, widgetId: string) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }

    return widget;
  }

  async widgetCreate(context: NcContext, widget: Partial<Widget>) {
    return await Widget.insert(context, widget);
  }

  async widgetUpdate(
    context: NcContext,
    widgetId: string,
    updateObj: Partial<Widget>,
  ) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }
    return await Widget.update(context, widgetId, updateObj);
  }

  async widgetDelete(context: NcContext, widgetId: string) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }

    return await Widget.delete(context, widgetId);
  }

  async widgetDataGet(context: NcContext, widgetId: string, req: NcRequest) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }

    if (![WidgetTypes.METRIC, WidgetTypes.CHART].includes(widget.type)) {
      NcError.badRequest(
        `Data retrieval not supported for widget type: ${widget.type}`,
      );
    }

    return await getWidgetData({ widget: widget as WidgetType, req });
  }
}
