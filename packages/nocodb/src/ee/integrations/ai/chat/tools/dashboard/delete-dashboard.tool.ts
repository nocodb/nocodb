import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const deleteDashboardTool = defineChatTool({
  name: ChatToolName.DELETE_DASHBOARD,
  description:
    'Permanently delete a dashboard and ALL its widgets. This CANNOT be undone. ' +
    'All widget configurations, filters, and data visualizations are lost. ' +
    'Call list_dashboards first to verify the dashboard name.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The exact title of the dashboard to delete (case-insensitive). ' +
          'Use list_dashboards to confirm the dashboard exists before deleting.',
      ),
  }),
  permission: 'dashboardDelete',
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

    await service.dashboardDelete(context, dashboard.id, req);

    return {
      message: `Dashboard "${args.dashboard_name}" has been permanently deleted.`,
    };
  },
});
