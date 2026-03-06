import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const listWidgetsTool: ChatToolDefinition = {
  name: 'list_widgets',
  description:
    "List all widgets in a dashboard. Returns each widget's id, title, type, grid position, " +
    'data source (table/view), and error state. ' +
    'Use this to see the current dashboard layout before adding, updating, or removing widgets.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to list widgets for (case-insensitive). ' +
          'Use list_dashboards to find available dashboard names.',
      ),
  },
  permission: 'widgetList',
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
};
