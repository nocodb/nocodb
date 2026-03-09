import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const deleteDashboardTool: ChatToolDefinition = {
  name: 'delete_dashboard',
  description:
    'Permanently delete a dashboard and ALL of its widgets. ' +
    'This CANNOT be undone. All widget configurations and data visualizations on this dashboard will be lost.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The exact title of the dashboard to delete (case-insensitive). ' +
          'Use list_dashboards to confirm the dashboard exists before deleting.',
      ),
  },
  permission: 'dashboardDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string },
    req: NcRequest,
  ) {
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
};
