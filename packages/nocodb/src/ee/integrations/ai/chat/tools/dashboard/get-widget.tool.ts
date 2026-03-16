import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveDashboardByName,
  resolveWidgetByName,
} from '~/integrations/ai/chat/tools/helpers';

export const getWidgetTool = defineChatTool({
  name: ChatToolName.GET_WIDGET,
  description:
    'Get a widget with its full configuration. Returns type, data source, grid position, and ' +
    'type-specific config (chart axes, metric aggregation, text content, iframe URL, etc.). ' +
    'Call this before update_widget — the config object is replaced entirely (not merged), ' +
    'so you need the current config to include unchanged fields.',
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe('The title of the widget to retrieve (case-insensitive).'),
  }),
  permission: 'widgetGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'dashboard',
  async execute(context, args, _req) {
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );
    const widget = await resolveWidgetByName(
      context,
      dashboard.id,
      args.widget_name,
    );

    return {
      id: widget.id,
      title: widget.title,
      type: widget.type,
      description: widget.description || null,
      position: widget.position,
      config: widget.config || null,
      fk_model_id: widget.fk_model_id || null,
      fk_view_id: widget.fk_view_id || null,
      error: widget.error || false,
    };
  },
});
