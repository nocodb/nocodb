import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const duplicateWidgetTool: ChatToolDefinition = {
  name: 'duplicate_widget',
  description:
    'Create a copy of an existing widget on the same dashboard. ' +
    'The duplicate keeps the same type, configuration, and data source but gets a unique name ' +
    'and is placed at the next available position on the grid. ' +
    'Useful for creating similar widgets with minor variations.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe('The title of the widget to duplicate (case-insensitive).'),
  },
  permission: 'widgetDuplicate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
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

    const newWidget = await service.duplicateWidget(context, widget.id, req);

    return {
      id: newWidget.id,
      title: newWidget.title,
      type: newWidget.type,
      position: newWidget.position,
      message: `Widget "${args.widget_name}" duplicated as "${newWidget.title}".`,
    };
  },
};
