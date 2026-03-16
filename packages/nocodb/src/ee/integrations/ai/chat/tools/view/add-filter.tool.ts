import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import Noco from '~/Noco';

export const addFilterTool = defineChatTool({
  name: ChatToolName.ADD_FILTER,
  description:
    'Add a filter condition to a view. Filters limit which records are shown without deleting data. ' +
    'Multiple filters combine using logical_op (and/or). ' +
    'Returns the filter_id for use with remove_filter. ' +
    'Call list_filters first to see existing filters before adding new ones.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the view (case-insensitive).',
      ),
    view_name: z
      .string()
      .optional()
      .describe(
        'The title of the view to add the filter to. If omitted, uses the first (default) view.',
      ),
    field_name: z
      .string()
      .describe('The title of the field to filter on (case-insensitive).'),
    operator: z
      .string()
      .describe(
        'Comparison operator. ' +
          'Text/General: eq, neq, like ("%search%"), nlike, in ("A,B"). ' +
          'Numeric: gt, lt, gte, lte, btw ("10,20"), nbtw. ' +
          'Null/Empty (no value needed): blank, notblank, null, notnull, empty, notempty. ' +
          'Checkbox (no value needed): checked, notchecked. ' +
          'Multi-Select: allof, anyof, nallof, nanyof. ' +
          'Date (requires sub_operator): eq, neq, gt, lt, gte, lte, isWithin. ' +
          'For value-less operators (blank, notblank, null, notnull, checked, notchecked): omit the value parameter.',
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
        'Sub-operator for date fields. Required when filtering Date, DateTime, CreatedTime, LastModifiedTime fields. ' +
          'Relative (no value): today, tomorrow, yesterday, oneWeekAgo, oneWeekFromNow, oneMonthAgo, oneMonthFromNow. ' +
          'Ranges (no value): pastWeek, pastMonth, pastYear, nextWeek, nextMonth, nextYear. ' +
          'Dynamic (value = number of days): daysAgo, daysFromNow, pastNumberOfDays, nextNumberOfDays. ' +
          'Exact (value = YYYY-MM-DD): exactDate. ' +
          'isWithin operator sub-operators: pastWeek, pastMonth, pastYear, nextWeek, nextMonth, nextYear, pastNumberOfDays, nextNumberOfDays.',
      ),
    logical_op: z
      .enum(['and', 'or'])
      .optional()
      .describe(
        'How this filter combines with existing filters on the view. ' +
          '"and" means all filters must match; "or" means any filter can match. Default: "and".',
      ),
  }),
  permission: 'filterCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
    const filtersV3Service: FiltersV3Service =
      Noco.nestApp.get(FiltersV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const value = args.value || null;
    const subOp = args.sub_operator || null;

    await filtersV3Service.filterCreate(context, {
      viewId: view.id,
      filter: {
        field_id: column.id,
        operator: args.operator,
        ...(subOp && { sub_operator: subOp }),
        value,
      },
      user: req.user,
      req,
    });

    return {
      message: `Filter added: "${args.field_name}" ${args.operator} ${
        args.value ?? ''
      }`.trim(),
    };
  },
});
