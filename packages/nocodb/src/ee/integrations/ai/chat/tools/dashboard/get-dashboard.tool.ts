import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const getDashboardTool: ChatToolDefinition = {
  name: 'get_dashboard',
  description:
    'Get detailed information about a specific dashboard including all its widgets. ' +
    'Returns the dashboard metadata and a list of widgets with their types, titles, positions, and configurations. ' +
    'Use this to understand the current layout before adding or updating widgets.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to retrieve (case-insensitive). ' +
          'Use list_dashboards to find available dashboard names.',
      ),
  },
  permission: 'dashboardGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string },
    _req: NcRequest,
  ) {
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
};
