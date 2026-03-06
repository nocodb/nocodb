import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const deleteWidgetTool: ChatToolDefinition = {
  name: 'delete_widget',
  description:
    'Permanently remove a widget from a dashboard. This CANNOT be undone. ' +
    "The widget's configuration and any associated filters will be lost. " +
    'Use list_widgets to confirm the widget name before deleting.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe(
        'The exact title of the widget to delete (case-insensitive). ' +
          'Use list_widgets to confirm the widget exists before deleting.',
      ),
  },
  permission: 'widgetDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string; widget_name: string },
    req: NcRequest,
  ) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );
    const widget = await resolveWidgetByName(
      context,
      dashboard.id,
      args.widget_name,
    );

    await service.widgetDelete(context, widget.id, req);

    return {
      message: `Widget "${args.widget_name}" has been permanently removed from dashboard "${args.dashboard_name}".`,
    };
  },
};
