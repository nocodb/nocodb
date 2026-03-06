import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import {
  validateWidgetConfig,
  WIDGET_CONFIG_DESCRIPTIONS,
} from './widget-schemas';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const updateWidgetTool: ChatToolDefinition = {
  name: 'update_widget',
  description:
    "Update an existing widget's title, configuration, data source, or position. " +
    'Use get_widget first to see the current config, then pass the updated fields. ' +
    'Only the fields you provide will be changed — unspecified fields remain unchanged. ' +
    'The config object is replaced entirely (not merged), so include all config fields when updating config.\n\n' +
    WIDGET_CONFIG_DESCRIPTIONS,
  parameters: {
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
    config: z
      .record(z.any())
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
  },
  permission: 'widgetUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      dashboard_name: string;
      widget_name: string;
      title?: string;
      config?: Record<string, any>;
      fk_model_id?: string;
      fk_view_id?: string;
      position?: { x: number; y: number; w: number; h: number };
    },
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
};
