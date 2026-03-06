import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName } from '../helpers';
import {
  validateWidgetConfig,
  WIDGET_CONFIG_DESCRIPTIONS,
} from './widget-schemas';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const createWidgetTool: ChatToolDefinition = {
  name: 'create_widget',
  description:
    'Add a new widget to a dashboard. Supported types: ' +
    '"chart" (bar, line, pie, donut), "metric" (single KPI number), ' +
    '"text" (markdown or plain text), "iframe" (embedded URL). ' +
    'Each widget needs a data source table (fk_model_id) except text and iframe widgets. ' +
    'Always provide position to place the widget on the grid. Use list_tables to find table IDs.\n\n' +
    WIDGET_CONFIG_DESCRIPTIONS,
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to add the widget to (case-insensitive).',
      ),
    title: z.string().describe('The display name for the new widget.'),
    type: z
      .enum(['chart', 'metric', 'text', 'iframe'])
      .describe('The widget type. Determines what config fields are required.'),
    config: z
      .record(z.any())
      .describe(
        'Type-specific configuration object. See the tool description for the exact schema per widget type.',
      ),
    fk_model_id: z
      .string()
      .optional()
      .describe(
        'The ID of the table to use as data source. Required for chart and metric widgets. ' +
          'Use list_tables to find table IDs.',
      ),
    fk_view_id: z
      .string()
      .optional()
      .describe(
        'Optional view ID to scope the data source to a specific view.',
      ),
    position: z
      .object({
        x: z.number().describe('Column position (0-based).'),
        y: z.number().describe('Row position (0-based).'),
        w: z.number().describe('Width in grid units (1-4).'),
        h: z.number().describe('Height in grid units.'),
      })
      .optional()
      .describe(
        'Grid position (REQUIRED). The dashboard uses a 4-column grid. ' +
          'Check existing widget positions (via list_widgets or get_dashboard) to avoid overlaps. ' +
          'Each widget type has size limits — see SIZE CONSTRAINTS in the tool description.',
      ),
  },
  permission: 'widgetCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      dashboard_name: string;
      title: string;
      type: string;
      config: Record<string, any>;
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

    // Validate config against the widget-type schema — gives clear errors
    // (e.g. "missing chartType") instead of failing deep in the service layer.
    const validatedConfig = validateWidgetConfig(args.type, args.config);

    const widget = await service.widgetCreate(
      context,
      {
        title: args.title,
        type: args.type as any,
        fk_dashboard_id: dashboard.id,
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
        config: validatedConfig,
        ...(args.fk_model_id && { fk_model_id: args.fk_model_id }),
        ...(args.fk_view_id && { fk_view_id: args.fk_view_id }),
        ...(args.position && { position: args.position }),
      },
      req,
    );

    return {
      id: widget.id,
      title: widget.title,
      type: widget.type,
      position: widget.position,
      error: widget.error || false,
      message: `Widget "${widget.title}" created successfully on dashboard "${dashboard.title}".`,
    };
  },
};
