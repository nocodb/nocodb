import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  validateWidgetConfig,
  WIDGET_CONFIG_DESCRIPTIONS,
  widgetConfigSchema,
} from '~/integrations/ai/chat/tools/dashboard/widget-schemas';
import { resolveDashboardByName } from '~/integrations/ai/chat/tools/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const createWidgetTool = defineChatTool({
  name: ChatToolName.CREATE_WIDGET,
  description:
    'Add a widget to a dashboard. Types: chart (bar/line/pie/donut), metric (single KPI), ' +
    'text (markdown/plain), iframe (embedded URL). ' +
    'Chart and metric widgets require a data source table (fk_model_id from list_tables). ' +
    'Text and iframe widgets do not need a data source. ' +
    'Always provide grid position to avoid overlapping. ' +
    'Call get_dashboard or list_widgets first to see occupied positions.\n\n' +
    WIDGET_CONFIG_DESCRIPTIONS,
  schema: z.object({
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard to add the widget to (case-insensitive).',
      ),
    title: z.string().describe('The display name for the new widget.'),
    type: z
      .enum(['chart', 'metric', 'text', 'iframe'])
      .describe('The widget type. Determines what config fields are required.'),
    config: widgetConfigSchema.describe(
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
  }),
  permission: 'widgetCreate',
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
        ...(args.position && {
          position: {
            x: args.position.x,
            y: args.position.y,
            w: args.position.w,
            h: args.position.h,
          },
        }),
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
});
