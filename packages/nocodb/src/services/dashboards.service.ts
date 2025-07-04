import { Injectable } from '@nestjs/common';
import { NcError } from 'src/helpers/ncError';
import { AppEvents, WidgetTypes } from 'nocodb-sdk';
import type { WidgetType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Dashboard from '~/models/Dashboard';
import Widget from '~/models/Widget';
import { getWidgetData } from '~/db/widgets';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';

@Injectable()
export class DashboardsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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
    insertObj: Partial<Dashboard>,
    req: NcRequest,
  ) {
    if (!insertObj.created_by) {
      insertObj.created_by = req.user?.id;
    }
    if (!insertObj.owned_by) {
      insertObj.owned_by = req.user?.id;
    }
    const dashboard = await Dashboard.insert(context, insertObj);

    this.appHooksService.emit(AppEvents.DASHBOARD_CREATE, {
      req,
      context,
      dashboard: dashboard,
      user: req.user,
    });

    return dashboard;
  }

  async dashboardUpdate(
    context: NcContext,
    dashboardId: string,
    updateObj: Partial<Dashboard>,
    req: NcRequest,
  ) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    const updatedDashboard = await Dashboard.update(
      context,
      dashboardId,
      updateObj,
    );

    this.appHooksService.emit(AppEvents.DASHBOARD_UPDATE, {
      context,
      oldDashboard: dashboard,
      dashboard: updatedDashboard,
      user: context.user,
      req,
    });

    return updatedDashboard;
  }

  async dashboardDelete(
    context: NcContext,
    dashboardId: string,
    req: NcRequest,
  ) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.notFound('Dashboard not found');
    }

    await Dashboard.delete(context, dashboardId);

    this.appHooksService.emit(AppEvents.DASHBOARD_DELETE, {
      dashboard,
      context,
      req: req,
      user: context.user,
    });

    return true;
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

  async widgetCreate(
    context: NcContext,
    insertObj: Partial<Widget>,
    req: NcRequest,
  ) {
    const widget = await Widget.insert(context, insertObj);

    this.appHooksService.emit(AppEvents.WIDGET_CREATE, {
      context,
      widget,
      user: context.user,
      req,
    });

    return widget;
  }

  async widgetUpdate(
    context: NcContext,
    widgetId: string,
    updateObj: Partial<Widget>,
    req: NcRequest,
  ) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }

    const updatedWidget = await Widget.update(context, widgetId, updateObj);

    this.appHooksService.emit(AppEvents.WIDGET_UPDATE, {
      context,
      oldWidget: widget,
      widget: updatedWidget,
      user: context.user,
      req,
    });

    return updatedWidget;
  }

  async widgetDelete(context: NcContext, widgetId: string, req: NcRequest) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.notFound('Widget not found');
    }
    await Widget.delete(context, widgetId);

    this.appHooksService.emit(AppEvents.WIDGET_DELETE, {
      context,
      widget,
      user: context.user,
      req,
    });

    return true;
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
