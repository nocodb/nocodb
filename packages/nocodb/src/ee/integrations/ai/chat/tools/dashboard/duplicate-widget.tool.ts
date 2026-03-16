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

export const duplicateWidgetTool = defineChatTool({
  name: ChatToolName.DUPLICATE_WIDGET,
  description:
    'Duplicate an existing widget on the same dashboard. ' +
    'The copy keeps the same type, config, and data source but gets a unique name and auto-placed position. ' +
    'Useful for creating variations — duplicate then update_widget to change the copy.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe('The title of the widget to duplicate (case-insensitive).'),
  }),
  permission: 'widgetDuplicate',
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
    const widget = await resolveWidgetByName(
      context,
      dashboard.id,
      args.widget_name,
    );

    const newWidget = await service.duplicateWidget(context, widget.id, req);

    return {
      id: newWidget.id,
      title: newWidget.title,
      type: newWidget.type,
      position: newWidget.position,
      message: `Widget "${args.widget_name}" duplicated as "${newWidget.title}".`,
    };
  },
});
