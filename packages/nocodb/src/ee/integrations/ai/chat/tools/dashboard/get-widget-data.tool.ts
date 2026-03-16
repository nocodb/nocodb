import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveDashboardByName,
  resolveWidgetByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const getWidgetDataTool = defineChatTool({
  name: ChatToolName.GET_WIDGET_DATA,
  description:
    'Fetch the computed data a widget displays. ' +
    'Metric widgets return the aggregated value. Chart widgets return the data series. ' +
    'Use this to verify a widget is correctly configured and showing expected results after creation or update.',
  schema: z.object({
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
  }),
  permission: 'widgetDataGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'dashboard',
  async execute(context, args, req) {
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
});
