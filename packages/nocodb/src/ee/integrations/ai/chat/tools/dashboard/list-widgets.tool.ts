import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';

export const listWidgetsTool = defineChatTool({
  name: ChatToolName.LIST_WIDGETS,
  description:
    'List all widgets in a dashboard. Returns id, title, type, grid position, data source, and error state. ' +
    'Call this before adding, updating, or removing widgets to see the current layout and find widget names.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to list widgets for (case-insensitive). ' +
          'Use list_dashboards to find available dashboard names.',
      ),
  }),
  permission: 'widgetList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'dashboard',
  async execute(context, args, _req) {
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );

    await dashboard.getWidgets(context);

    return (dashboard.widgets || []).map((w: any) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      position: w.position,
      fk_model_id: w.fk_model_id || null,
      fk_view_id: w.fk_view_id || null,
      error: w.error || false,
    }));
  },
});
