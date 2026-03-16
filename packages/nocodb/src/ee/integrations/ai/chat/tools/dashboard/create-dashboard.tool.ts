import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const createDashboardTool = defineChatTool({
  name: ChatToolName.CREATE_DASHBOARD,
  description:
    'Create a new empty dashboard in the current base. ' +
    'Dashboards are visual canvases for widgets: charts (bar/line/pie/donut), metrics (KPIs), ' +
    'text (markdown), and iframes (embedded URLs). ' +
    'After creation, use create_widget to add widgets and open_dashboard to navigate to it.',
  schema: z.object({
    title: z.string().describe('The display name for the new dashboard.'),
    description: z
      .string()
      .optional()
      .describe(
        'An optional description explaining the purpose of the dashboard.',
      ),
  }),
  permission: 'dashboardCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'dashboard',
  async execute(context, args, req) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);

    const dashboard = await service.dashboardCreate(
      context,
      {
        title: args.title,
        ...(args.description && { description: args.description }),
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
      },
      req,
    );

    return {
      id: dashboard.id,
      title: dashboard.title,
      message: `Dashboard "${dashboard.title}" created successfully.`,
    };
  },
});
