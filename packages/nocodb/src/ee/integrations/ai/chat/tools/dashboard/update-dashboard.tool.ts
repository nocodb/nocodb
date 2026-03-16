import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const updateDashboardTool = defineChatTool({
  name: ChatToolName.UPDATE_DASHBOARD,
  description:
    'Update a dashboard title or description. Only provided fields are changed — omitted fields stay the same. ' +
    'This does not affect widgets — use update_widget for widget changes.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The current title of the dashboard to update (case-insensitive). ' +
          'Use list_dashboards to find available dashboard names.',
      ),
    title: z.string().optional().describe('The new title for the dashboard.'),
    description: z
      .string()
      .optional()
      .describe('The new description for the dashboard.'),
  }),
  permission: 'dashboardUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'dashboard',
  async execute(context, args, req) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );

    const updateObj: Record<string, any> = {};
    if (args.title !== undefined) updateObj.title = args.title;
    if (args.description !== undefined)
      updateObj.description = args.description;

    const updated = await service.dashboardUpdate(
      context,
      dashboard.id,
      updateObj,
      req,
    );

    return {
      id: updated.id,
      title: updated.title,
      message: `Dashboard updated successfully.`,
    };
  },
});
