import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  validateWidgetConfig,
  WIDGET_CONFIG_DESCRIPTIONS,
  widgetConfigSchema,
} from '~/integrations/ai/chat/tools/dashboard/widget-schemas';
import {
  resolveDashboardByName,
  resolveWidgetByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const updateWidgetTool = defineChatTool({
  name: ChatToolName.UPDATE_WIDGET,
  description:
    'Update a widget — title, config, data source, or position. ' +
    'IMPORTANT: Call get_widget first — the config object is replaced entirely (not merged), ' +
    'so you must include ALL config fields when updating config. ' +
    'Only fields you provide are changed — omitted top-level fields stay the same.\n\n' +
    WIDGET_CONFIG_DESCRIPTIONS,
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe(
        'The current title of the widget to update (case-insensitive).',
      ),
    title: z.string().optional().describe('New display name for the widget.'),
    config: widgetConfigSchema
      .optional()
      .describe(
        'Updated type-specific configuration. Replaces the entire config — ' +
          'use get_widget to read the current config first, then pass the full updated config.',
      ),
    fk_model_id: z
      .string()
      .optional()
      .describe(
        'New table ID for the data source. Use list_tables to find table IDs.',
      ),
    fk_view_id: z
      .string()
      .optional()
      .describe('New view ID to scope the data source.'),
    position: z
      .object({
        x: z.number().describe('Column position (0-based).'),
        y: z.number().describe('Row position (0-based).'),
        w: z.number().describe('Width in grid units (1-4).'),
        h: z.number().describe('Height in grid units.'),
      })
      .optional()
      .describe('Updated grid position on the dashboard.'),
  }),
  permission: 'widgetUpdate',
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

    const updateObj: Record<string, any> = {};
    if (args.title !== undefined) updateObj.title = args.title;
    if (args.config !== undefined) {
      updateObj.config = validateWidgetConfig(widget.type, args.config);
    }
    if (args.fk_model_id !== undefined)
      updateObj.fk_model_id = args.fk_model_id;
    if (args.fk_view_id !== undefined) updateObj.fk_view_id = args.fk_view_id;
    if (args.position !== undefined) updateObj.position = args.position;

    const updated = await service.widgetUpdate(
      context,
      widget.id,
      updateObj,
      req,
    );

    return {
      id: updated.id,
      title: updated.title,
      type: updated.type,
      position: updated.position,
      error: updated.error || false,
      message: `Widget "${updated.title}" updated successfully.`,
    };
  },
});
