import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveDashboardByName,
  resolveWidgetByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const deleteWidgetTool = defineChatTool({
  name: ChatToolName.DELETE_WIDGET,
  description:
    'Permanently remove a widget from a dashboard. This CANNOT be undone. ' +
    'The widget configuration and any associated filters are lost. ' +
    'Call list_widgets first to verify the widget name.',
  schema: z.object({
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
  }),
  permission: 'widgetDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  visibility: 'action',
  category: 'dashboard',
  async execute(context, args, req) {
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
});
