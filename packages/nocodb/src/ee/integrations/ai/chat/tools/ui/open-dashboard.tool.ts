import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const openDashboardTool: ChatToolDefinition = {
  name: 'open_dashboard',
  description:
    'Open a dashboard in the UI. Navigates the user to the specified dashboard in the current base.',
  parameters: {
    dashboard_name: z
      .string()
      .describe('The title of the dashboard to open (case-insensitive).'),
  },
  permission: 'dashboardList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  uiOnly: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string },
    _req: NcRequest,
  ) {
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
};
