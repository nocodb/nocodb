import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';
import Model from '~/models/Model';

export const listWidgetFiltersTool: ChatToolDefinition = {
  name: 'list_widget_filters',
  description:
    "List all filter conditions on a widget. Returns each filter's id (needed for remove_widget_filter), " +
    'field name, operator, value, and logical_op (and/or). ' +
    'Use this before remove_widget_filter to find the filter ID to remove.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe(
        'The title of the widget to list filters for (case-insensitive).',
      ),
  },
  permission: 'widgetFilterList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { dashboard_name: string; widget_name: string },
    _req: NcRequest,
  ) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);
    const dashboard = await resolveDashboardByName(
      context,
      args.dashboard_name,
    );
    const widget = await resolveWidgetByName(
      context,
      dashboard.id,
      args.widget_name,
    );

    const filters = await filtersService.widgetFilterList(context, {
      widgetId: widget.id,
    });

    // Resolve column names if the widget has a data source table
    let colMap = new Map<string, string>();
    if (widget.fk_model_id) {
      const model = await Model.get(context, widget.fk_model_id);
      const columns = await model.getColumns(context);
      colMap = new Map(columns.map((c) => [c.id, c.title]));
    }

    return (filters as any[]).map((f) => ({
      id: f.id,
      field_name: colMap.get(f.fk_column_id) || f.fk_column_id,
      operator: f.comparison_op,
      ...(f.comparison_sub_op && { sub_operator: f.comparison_sub_op }),
      value: f.value,
      logical_op: f.logical_op || 'and',
    }));
  },
};
