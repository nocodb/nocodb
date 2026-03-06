import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const updateDashboardTool: ChatToolDefinition = {
  name: 'update_dashboard',
  description:
    "Update a dashboard's title or description. " +
    'Use this to rename a dashboard or change its description.',
  parameters: {
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
  },
  permission: 'dashboardUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { dashboard_name: string; title?: string; description?: string },
    req: NcRequest,
  ) {
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
};
