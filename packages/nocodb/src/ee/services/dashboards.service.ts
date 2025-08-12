import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppEvents,
  calculateNextPosition,
  EventType,
  generateUniqueCopyName,
  ncIsNull,
  ncIsUndefined,
  type WidgetType,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardType } from 'nocodb-sdk';
import type { AppConfig, NcContext, NcRequest } from '~/interface/config';
import { CustomUrl, Dashboard, Widget } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getWidgetData, getWidgetHandler } from '~/db/widgets';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import config from '~/app.config';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class DashboardsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly configService: ConfigService<AppConfig>,
  ) {}

  async dashboardList(context: NcContext, baseId: string) {
    return await Dashboard.list(context, baseId);
  }

  async dashboardGet(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboard.id,
          action: 'create',
          payload: dashboard as DashboardType,
        },
      },
      context.socket_id,
    );

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
      NcError.get(context).dashboardNotFound(dashboardId);
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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboardId,
          action: 'update',
          payload: updatedDashboard as DashboardType,
        },
      },
      context.socket_id,
    );

    return updatedDashboard;
  }

  async dashboardDelete(
    context: NcContext,
    dashboardId: string,
    req: NcRequest,
  ) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    await Dashboard.delete(context, dashboardId);

    this.appHooksService.emit(AppEvents.DASHBOARD_DELETE, {
      dashboard,
      context,
      req: req,
      user: context.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboardId,
          action: 'delete',
          payload: dashboard as DashboardType,
        },
      },
      context.socket_id,
    );

    return true;
  }

  async widgetList(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    return await Widget.list(context, dashboardId);
  }

  async widgetGet(context: NcContext, widgetId: string) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    return widget;
  }

  async widgetCreate(
    context: NcContext,
    insertObj: Partial<Widget>,
    req: NcRequest,
  ) {
    const widget = await Widget.insert(context, insertObj);

    const handler = await getWidgetHandler(context, {
      widget: widget as WidgetType,
      req,
    });

    const errors = await handler.validateWidgetData(context, widget as any);

    const hasErrors = errors?.length > 0;

    // Only update if error state changed from the initial state
    if (widget.error !== hasErrors) {
      await Widget.update(context, widget.id, {
        error: hasErrors,
      });
    }

    widget.error = hasErrors;

    this.appHooksService.emit(AppEvents.WIDGET_CREATE, {
      context,
      widget: widget as WidgetType,
      user: context.user,
      req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WIDGET_EVENT,
        payload: {
          id: widget.id,
          dashboardId: widget.fk_dashboard_id,
          action: 'create',
          payload: widget as WidgetType,
        },
      },
      context.socket_id,
    );

    return widget;
  }

  async duplicateWidget(context: NcContext, widgetId: string, req: NcRequest) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    const existingWidgets = await Widget.list(context, widget.fk_dashboard_id);

    const newTitle = generateUniqueCopyName(widget.title, existingWidgets, {
      accessor: (item) => item.title,
    });

    const newWidget = await Widget.insert(context, {
      title: newTitle,
      config: widget.config,
      fk_dashboard_id: widget.fk_dashboard_id,
      position: {
        ...widget.position,
        ...calculateNextPosition(
          existingWidgets as WidgetType[],
          widget.position,
        ),
      },
      type: widget.type,
      error: widget.error,
      ...(widget.meta && { meta: widget.meta }),
      ...(widget.fk_model_id && { fk_model_id: widget.fk_model_id }),
      ...(widget.fk_view_id && { fk_view_id: widget.fk_view_id }),
      ...(widget.description && { description: widget.description }),
    });

    const handler = await getWidgetHandler(context, {
      widget: newWidget as WidgetType,
      req,
    });

    const errors = await handler.validateWidgetData(context, newWidget as any);

    const hasErrors = errors?.length > 0;
    newWidget.error = hasErrors;

    // Only update if error state changed from the original
    if (widget.error !== hasErrors) {
      await Widget.update(context, newWidget.id, {
        error: hasErrors,
      });
    }

    this.appHooksService.emit(AppEvents.WIDGET_DUPLICATE, {
      sourceWidget: widget as WidgetType,
      destWidget: newWidget as WidgetType,
      context,
      req: req,
      user: context.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WIDGET_EVENT,
        payload: {
          id: newWidget.id,
          dashboardId: newWidget.fk_dashboard_id,
          action: 'create',
          payload: newWidget as WidgetType,
        },
      },
      context.socket_id,
    );

    return newWidget;
  }

  async widgetUpdate(
    context: NcContext,
    widgetId: string,
    updateObj: Partial<Widget>,
    req: NcRequest,
  ) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    const updatedWidget = await Widget.update(context, widgetId, updateObj);

    const handler = await getWidgetHandler(context, {
      widget: updatedWidget as WidgetType,
      req,
    });

    const errors = await handler.validateWidgetData(
      context,
      updatedWidget as any,
    );

    const hasErrors = errors?.length > 0;
    updatedWidget.error = hasErrors;

    // Only update if state changed
    if (widget.error !== hasErrors) {
      await Widget.update(context, updatedWidget.id, {
        error: hasErrors,
      });
    }

    this.appHooksService.emit(AppEvents.WIDGET_UPDATE, {
      context,
      oldWidget: widget as WidgetType,
      widget: updatedWidget as WidgetType,
      user: context.user,
      req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WIDGET_EVENT,
        payload: {
          id: widgetId,
          dashboardId: updatedWidget.fk_dashboard_id,
          action: 'update',
          payload: updatedWidget as WidgetType,
        },
      },
      context.socket_id,
    );

    return updatedWidget;
  }

  async widgetDelete(context: NcContext, widgetId: string, req: NcRequest) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }
    await Widget.delete(context, widgetId);

    this.appHooksService.emit(AppEvents.WIDGET_DELETE, {
      context,
      widget: widget as WidgetType,
      user: context.user,
      req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WIDGET_EVENT,
        payload: {
          id: widgetId,
          dashboardId: widget.fk_dashboard_id,
          action: 'delete',
          payload: widget as WidgetType,
        },
      },
      context.socket_id,
    );

    return true;
  }

  async widgetDataGet(context: NcContext, widgetId: string, req: NcRequest) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    return await getWidgetData(context, { widget: widget as WidgetType, req });
  }

  async dashboardShare(
    context: NcContext,
    updateObj: Partial<Dashboard> & {
      custom_url_path?: string;
    },
    req: NcRequest,
  ) {
    // Get existing dashboard
    const dashboard = await Dashboard.get(context, updateObj.id);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(updateObj.id);
    }

    let newDashboard: Dashboard;
    let customUrl: CustomUrl | undefined;

    // Check if dashboard is already shared
    if (dashboard.uuid) {
      // Dashboard is already shared

      // User wants to remove sharing entirely
      if (ncIsNull(updateObj.uuid)) {
        // Clean up existing custom URL if it exists
        if (dashboard.fk_custom_url_id) {
          await CustomUrl.delete({ id: dashboard.fk_custom_url_id });
        }

        newDashboard = await Dashboard.update(context, dashboard.id, {
          uuid: null,
          password: null,
          fk_custom_url_id: null,
        });

        this.appHooksService.emit(AppEvents.SHARED_DASHBOARD_DELETE_LINK, {
          context,
          req,
          link: this.getUrl({
            dashboard: newDashboard as Dashboard,
            siteUrl: req.ncSiteUrl,
          }),
          dashboard: newDashboard as Dashboard,
        });
      } else {
        // User wants to update existing sharing settings

        // Get existing custom URL if it exists
        customUrl = dashboard.fk_custom_url_id
          ? await CustomUrl.get({ id: dashboard.fk_custom_url_id })
          : undefined;

        const original_path = `/nc/dashboard/${dashboard.uuid}`;

        // Handle custom URL operations
        if (!ncIsUndefined(updateObj.custom_url_path)) {
          // Case 1: Custom URL path is provided (create or update)
          if (updateObj.custom_url_path && updateObj.custom_url_path.trim()) {
            if (customUrl?.id) {
              // Update existing custom URL
              await CustomUrl.update(dashboard.fk_custom_url_id!, {
                original_path,
                custom_path: updateObj.custom_url_path.trim(),
              });
              customUrl = await CustomUrl.get({
                id: dashboard.fk_custom_url_id!,
              });
            } else {
              // Create new custom URL
              customUrl = await CustomUrl.insert({
                fk_workspace_id: dashboard.fk_workspace_id,
                fk_dashboard_id: dashboard.id,
                original_path,
                custom_path: updateObj.custom_url_path.trim(),
              });
            }
          } else {
            // Case 2: Custom URL path is null/empty/falsy (delete existing)
            if (customUrl?.id) {
              await CustomUrl.delete({ id: customUrl.id });
              customUrl = undefined;
            }
          }
        }
        // If custom_url_path is undefined, no change to custom URL

        // Update dashboard with new settings
        const updateData: Partial<Dashboard> = {
          fk_custom_url_id: customUrl?.id ?? null,
        };

        // Only update password if provided
        if (!ncIsUndefined(updateObj.password)) {
          updateData.password = updateObj.password;
        }

        newDashboard = await Dashboard.update(
          context,
          dashboard.id,
          updateData,
        );

        this.appHooksService.emit(AppEvents.SHARED_DASHBOARD_UPDATE_LINK, {
          context,
          req,
          link: this.getUrl({
            dashboard: newDashboard as Dashboard,
            siteUrl: req.ncSiteUrl,
          }),
          dashboard: newDashboard as Dashboard,
          customUrl,
        });
      }
    } else {
      // CASE B: Dashboard is not shared yet, create new share
      const uuid = uuidv4();

      // Create custom URL if requested
      if (updateObj.custom_url_path && updateObj.custom_url_path.trim()) {
        customUrl = await CustomUrl.insert({
          fk_workspace_id: dashboard.fk_workspace_id,
          fk_dashboard_id: dashboard.id,
          original_path: `/dashboard/${uuid}`,
          custom_path: updateObj.custom_url_path.trim(),
        });
      }

      // Update dashboard with sharing settings
      const updateData: Partial<Dashboard> = {
        uuid,
        password: updateObj.password ?? null,
        fk_custom_url_id: customUrl?.id ?? null,
      };

      newDashboard = await Dashboard.update(context, dashboard.id, updateData);

      this.appHooksService.emit(AppEvents.SHARED_DASHBOARD_GENERATE_LINK, {
        context,
        req,
        link: this.getUrl({
          dashboard: newDashboard as Dashboard,
          siteUrl: req.ncSiteUrl,
        }),
        uuid: newDashboard.uuid,
        dashboard: newDashboard as Dashboard,
        customUrl,
      });
    }

    return newDashboard;
  }
  private getUrl({
    dashboard,
    siteUrl: _siteUrl,
  }: {
    dashboard: Dashboard;
    siteUrl: string;
  }) {
    let siteUrl = _siteUrl;

    const baseDomain = process.env.NC_BASE_HOST_NAME;
    const dashboardPath = this.configService.get('dashboardPath', {
      infer: true,
    });

    if (baseDomain) {
      siteUrl = `https://${dashboard['fk_workspace_id']}.${baseDomain}${dashboardPath}`;
    }

    return `${siteUrl}${config.dashboardPath}#/dashboard/${dashboard.uuid}`;
  }
}
