import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const getWidgetDataTool: ChatToolDefinition = {
  name: 'get_widget_data',
  description:
    'Fetch the computed data for a widget. Returns the aggregated or queried data that the widget displays. ' +
    'For metric widgets this is the computed value, for chart widgets it is the chart data series, etc. ' +
    'Use this to verify a widget is correctly configured and showing expected data.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe(
        'The title of the widget to fetch data for (case-insensitive).',
      ),
  },
  permission: 'widgetDataGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string; widget_name: string },
    req: NcRequest,
  ) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );
    const widget = await resolveWidgetByName(
      context,
      dashboard.id,
      args.widget_name,
    );

    return await service.widgetDataGet(context, widget.id, req);
  },
};
