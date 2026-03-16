import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';

export const openDashboardTool = defineChatTool({
  name: ChatToolName.OPEN_DASHBOARD,
  description:
    'Navigate the user to a dashboard in the current base. ' +
    'The dashboard will be displayed in the main content area. ' +
    'Use list_dashboards to discover available dashboards first.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe('The title of the dashboard to open (case-insensitive).'),
  }),
  permission: 'dashboardList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  uiOnly: true,
  visibility: 'ui',
  category: 'ui',
  async execute(context, args, _req) {
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );

    return {
      __ui_action: 'open_dashboard',
      base_id: context.base_id,
      dashboard_id: dashboard.id,
      message: `Opening dashboard "${dashboard.title}".`,
    };
  },
});
