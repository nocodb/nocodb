import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';

export const getDashboardTool = defineChatTool({
  name: ChatToolName.GET_DASHBOARD,
  description:
    'Get a dashboard with all its widgets. Returns dashboard metadata plus widget list with types, ' +
    'titles, grid positions, and configurations. ' +
    'Call this before adding or updating widgets to understand the current layout and avoid position conflicts.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to retrieve (case-insensitive). ' +
          'Use list_dashboards to find available dashboard names.',
      ),
  }),
  permission: 'dashboardGet',
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

    return {
      id: dashboard.id,
      title: dashboard.title,
      description: dashboard.description || null,
      widgets: (dashboard.widgets || []).map((w: any) => ({
        id: w.id,
        title: w.title,
        type: w.type,
        position: w.position,
        fk_model_id: w.fk_model_id || null,
        fk_view_id: w.fk_view_id || null,
        error: w.error || false,
      })),
    };
  },
});
