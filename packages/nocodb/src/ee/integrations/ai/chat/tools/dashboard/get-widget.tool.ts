import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const getWidgetTool: ChatToolDefinition = {
  name: 'get_widget',
  description:
    'Get detailed information about a specific widget including its full configuration. ' +
    'Returns the widget type, data source, position, and type-specific config ' +
    '(chart axes, metric aggregation, text content, iframe URL, etc.). ' +
    'Use this before update_widget to see the current configuration.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe('The title of the widget to retrieve (case-insensitive).'),
  },
  permission: 'widgetGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string; widget_name: string },
    _req: NcRequest,
  ) {
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
};
