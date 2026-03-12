import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDashboardByName, resolveWidgetByName } from '../helpers';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';
import Model from '~/models/Model';
import { NcError } from '~/helpers/ncError';

export const addWidgetFilterTool: ChatToolDefinition = {
  name: 'add_widget_filter',
  description:
    'Add a filter condition to a widget to scope the data it displays. ' +
    'Only applies when the widget\'s config.dataSource is "filter". ' +
    'Set config.dataSource to "filter" first (via create_widget or update_widget), ' +
    'then use this tool to add filter conditions. ' +
    'Multiple filters are combined using logical_op (and/or). ' +
    'The widget must have a data source table (fk_model_id). ' +
    'Use describe_table to find field names, then use the field name to filter.',
  parameters: {
    dashboard_name: z
      .string()
      .describe(
        'The title of the dashboard containing the widget (case-insensitive).',
      ),
    widget_name: z
      .string()
      .describe(
        'The title of the widget to add the filter to (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe('The title of the field to filter on (case-insensitive).'),
    operator: z
      .string()
      .describe(
        'Comparison operator. ' +
          'Equality: eq, neq. ' +
          'Comparison: gt, lt, gte, lte, btw ("10,20"), nbtw. ' +
          'Text: like ("%search%"), nlike. ' +
          'Presence: null, notnull, blank (null OR empty), notblank, empty, notempty. ' +
          'Checkbox: checked, notchecked. ' +
          'Select: in ("A,B"), allof, anyof, nallof, nanyof. ' +
          'Date: is, isnot, isWithin — values: "today", "thisWeek", "thisMonth", "pastWeek", "nextMonth". ' +
          'Value-less operators (blank, notblank, null, notnull, checked, notchecked): omit the value parameter.',
      ),
    value: z
      .string()
      .optional()
      .describe(
        'The value to compare against. Omit for operators that do not need a value ' +
          '(blank, notblank, null, notnull, checked, notchecked). ' +
          'For "in" operator, use comma-separated values: "Active,Pending". ' +
          'For "like" operator, use % as wildcard: "%search%".',
      ),
    sub_operator: z
      .string()
      .optional()
      .describe(
        'Sub-operator for date fields. Required when operator is "is", "isnot", or "isWithin". ' +
          'Values: "today", "tomorrow", "yesterday", "oneWeekAgo", "oneWeekFromNow", ' +
          '"oneMonthAgo", "oneMonthFromNow", "daysAgo", "daysFromNow", ' +
          '"exactDate", "pastWeek", "pastMonth", "pastYear", "nextWeek", "nextMonth", "nextYear", ' +
          '"pastNumberOfDays", "nextNumberOfDays". ' +
          'For "daysAgo", "daysFromNow", "pastNumberOfDays", "nextNumberOfDays" and "exactDate": provide the number or date in the value parameter.',
      ),
    logical_op: z
      .enum(['and', 'or'])
      .optional()
      .describe(
        'How this filter combines with existing filters on the widget. ' +
          '"and" means all filters must match; "or" means any filter can match. Default: "and".',
      ),
  },
  permission: 'widgetFilterCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      dashboard_name: string;
      widget_name: string;
      field_name: string;
      operator: string;
      value?: string;
      sub_operator?: string;
      logical_op?: string;
    },
    req: NcRequest,
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

    const ncError = NcError.get(context);

    if (!widget.fk_model_id) {
      ncError.badRequest(
        'Widget has no data source table. Set fk_model_id first.',
      );
    }

    const model = await Model.get(context, widget.fk_model_id);
    const columns = await model.getColumns(context);

    const lowerName = args.field_name.toLowerCase();
    const column = columns.find((c) => c.title?.toLowerCase() === lowerName);
    if (!column) {
      ncError.fieldNotFound(args.field_name);
    }

    // Normalize empty strings to null — LLMs often pass "" for optional fields,
    // but the swagger schema only accepts valid enum values or null.
    const value = args.value || null;
    const subOp = args.sub_operator || null;
    const logicalOp = args.logical_op || null;

    const filter = await filtersService.widgetFilterCreate(context, {
      widgetId: widget.id,
      filter: {
        fk_column_id: column.id,
        comparison_op: args.operator as FilterType['comparison_op'],
        ...(subOp && {
          comparison_sub_op: subOp as FilterType['comparison_sub_op'],
        }),
        value,
        ...(logicalOp && { logical_op: logicalOp as FilterType['logical_op'] }),
      },
      user: req.user,
      req,
    });

    return {
      message: `Filter added to widget "${widget.title}": "${
        args.field_name
      }" ${args.operator} ${args.value ?? ''}`.trim(),
      filter_id: filter.id,
    };
  },
};
