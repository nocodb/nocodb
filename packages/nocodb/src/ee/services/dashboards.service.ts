import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  calculateNextPosition,
  DependencyTableType,
  EventType,
  generateUniqueCopyName,
  ncIsNull,
  ncIsUndefined,
  PlanLimitTypes,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { DashboardType, WidgetType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { CustomUrl, Dashboard, DependencyTracker, Widget } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getReplay } from '~/helpers/replayScope';
import { getWidgetData, getWidgetHandler } from '~/db/widgets';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import NocoSocket from '~/socket/NocoSocket';
import { checkLimit } from '~/helpers/paymentHelpers';
import { TraceCommand } from '~/decorators/trace-command.decorator';
@Injectable()
export class DashboardsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {}

  async dashboardList(context: NcContext, baseId: string) {
    const dashboards = await Dashboard.list(context, baseId);
    // Mask bcrypt password hashes — the owner UI only needs to know whether
    // a password is set, not its stored value.
    return dashboards.map((d) => Dashboard.maskPasswordForResponse(d));
  }

  async dashboardGet(context: NcContext, dashboardId: string) {
    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    await dashboard.getWidgets(context);

    return Dashboard.maskPasswordForResponse(dashboard);
  }

  @TraceCommand(OperationName.dashboardCreate)
  async dashboardCreate(
    context: NcContext,
    param: {
      dashboard: Partial<Dashboard>;
      req: NcRequest;
    },
  ) {
    const { req } = param;
    const insertObj = param.dashboard;

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    if (!insertObj.created_by) {
      insertObj.created_by = req.user?.id;
    }
    if (!insertObj.owned_by) {
      insertObj.owned_by = req.user?.id;
    }

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} dashboard for your plan.`,
    });

    insertObj.title = insertObj.title?.trim();

    const dashboard = await Dashboard.insert(context, insertObj);

    this.appHooksService.emit(AppEvents.DASHBOARD_CREATE, {
      req,
      context,
      dashboard: dashboard,
      user: req.user,
    });

    const safeDashboard = Dashboard.maskPasswordForResponse(
      dashboard as Dashboard,
    );

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboard.id,
          action: 'create',
          payload: safeDashboard as DashboardType,
        },
      },
      context.socket_id,
    );

    return safeDashboard;
  }

  @TraceCommand(OperationName.dashboardUpdate)
  async dashboardUpdate(
    context: NcContext,
    param: {
      dashboardId: string;
      dashboard: Partial<Dashboard>;
      req: NcRequest;
    },
  ) {
    const { dashboardId, req } = param;
    const updateObj = param.dashboard;

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const dashboard = await Dashboard.get(context, dashboardId);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    updateObj.title = updateObj.title?.trim();

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

    // Strip the stored bcrypt password hash from every outbound payload.
    const safeDashboard = Dashboard.maskPasswordForResponse(
      updatedDashboard as Dashboard,
    );

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboardId,
          action: 'update',
          payload: safeDashboard as DashboardType,
        },
      },
      context.socket_id,
    );

    return safeDashboard;
  }

  @TraceCommand(OperationName.dashboardDelete)
  async dashboardDelete(
    context: NcContext,
    param: {
      dashboardId: string;
      req: NcRequest;
      ncMeta?: MetaService;
    },
  ) {
    const { dashboardId, req, ncMeta } = param;

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const dashboard = await Dashboard.get(context, dashboardId, false, ncMeta);

    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: dashboardId,
      resourceType: 'dashboard',
      user: req.user,
      req,
      ncMeta,
    });

    this.appHooksService.emit(AppEvents.DASHBOARD_DELETE, {
      dashboard,
      context,
      req,
      user: context.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DASHBOARD_EVENT,
        payload: {
          id: dashboardId,
          action: 'delete',
          payload: Dashboard.maskPasswordForResponse(
            dashboard as Dashboard,
          ) as DashboardType,
        },
      },
      context.socket_id,
    );

    return true;
  }

  private async assertDashboardLive(
    context: NcContext,
    dashboardId: string,
    ncMeta?: MetaService,
  ) {
    const dashboard = await Dashboard.get(context, dashboardId, false, ncMeta);
    if (!dashboard) {
      NcError.get(context).dashboardNotFound(dashboardId);
    }
    return dashboard;
  }

  async widgetList(context: NcContext, dashboardId: string) {
    await this.assertDashboardLive(context, dashboardId);

    return await Widget.list(context, dashboardId);
  }

  async widgetGet(context: NcContext, widgetId: string) {
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    await this.assertDashboardLive(context, widget.fk_dashboard_id);

    return widget;
  }

  @TraceCommand(OperationName.widgetCreate)
  async widgetCreate(
    context: NcContext,
    param: {
      widget: Partial<Widget>;
      dashboardId?: string;
      req: NcRequest;
    },
  ) {
    const { req } = param;
    const insertObj = param.widget;

    if (!insertObj.fk_dashboard_id && param.dashboardId) {
      insertObj.fk_dashboard_id = param.dashboardId;
    }
    if (!insertObj.fk_dashboard_id) {
      NcError.get(context).requiredFieldMissing('fk_dashboard_id');
    }

    await this.assertDashboardLive(context, insertObj.fk_dashboard_id);

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

    try {
      const dependencies = handler.extractDependencies(widget as any);
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Widget,
        widget.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to track widget dependencies:', error);
    }

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

  @TraceCommand(OperationName.duplicateWidget)
  async duplicateWidget(
    context: NcContext,
    param: {
      widgetId: string;
      req: NcRequest;
    },
  ) {
    const { widgetId, req } = param;
    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    await this.assertDashboardLive(context, widget.fk_dashboard_id);

    const existingWidgets = await Widget.list(context, widget.fk_dashboard_id);

    const newTitle = generateUniqueCopyName(widget.title, existingWidgets, {
      accessor: (item) => item.title,
    });

    const replayId = getReplay('replayDuplicateId');
    const newWidget = await Widget.insert(context, {
      ...(replayId ? { id: replayId } : {}),
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

    try {
      const dependencies = handler.extractDependencies(newWidget as any);
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Widget,
        newWidget.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to track widget dependencies:', error);
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

  @TraceCommand(OperationName.widgetUpdate)
  async widgetUpdate(
    context: NcContext,
    param: {
      widgetId: string;
      widget: Partial<Widget>;
      req: NcRequest;
    },
  ) {
    const { widgetId, req } = param;
    const updateObj = param.widget;

    const widget = await Widget.get(context, widgetId);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    await this.assertDashboardLive(context, widget.fk_dashboard_id);

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

    try {
      const dependencies = handler.extractDependencies(updatedWidget as any);
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Widget,
        updatedWidget.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to update widget dependencies:', error);
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

  @TraceCommand(OperationName.widgetDelete)
  async widgetDelete(
    context: NcContext,
    param: {
      widgetId: string;
      req: NcRequest;
      ncMeta?: MetaService;
    },
  ) {
    const { widgetId, req, ncMeta } = param;
    const widget = await Widget.get(context, widgetId, false, ncMeta);

    if (!widget) {
      NcError.get(context).widgetNotFound(widgetId);
    }

    await this.assertDashboardLive(context, widget.fk_dashboard_id, ncMeta);

    await this.baseTrashService.trashResource(context, {
      resourceId: widgetId,
      resourceType: 'widget',
      user: req.user,
      req,
      ncMeta,
    });

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

    await this.assertDashboardLive(context, widget.fk_dashboard_id);

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

        // Strip the bcrypt hash before the dashboard flows through emits or
        // the return path — no event listener should ever see it.
        newDashboard = Dashboard.maskPasswordForResponse(
          newDashboard as Dashboard,
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

      // Strip the bcrypt hash before the dashboard flows through emits or
      // the return path — no event listener should ever see it.
      newDashboard = Dashboard.maskPasswordForResponse(
        newDashboard as Dashboard,
      );

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

    return newDashboard as Dashboard;
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

    if (baseDomain) {
      siteUrl = `https://${dashboard['fk_workspace_id']}.${baseDomain}`;
    }

    return `${siteUrl}/dashboard/${dashboard.uuid}`;
  }
}
