import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '../helpers';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

export const addFilterTool: ChatToolDefinition = {
  name: 'add_filter',
  description:
    'Add a filter condition to a view. Filters limit which records are shown in the view without deleting data. ' +
    'Multiple filters are combined using logical_op (and/or). ' +
    'Returns the filter_id which you can use later with remove_filter.',
  parameters: {
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
        'How this filter combines with existing filters on the view. ' +
          '"and" means all filters must match; "or" means any filter can match. Default: "and".',
      ),
  },
  permission: 'filterCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      view_name?: string;
      field_name: string;
      operator: string;
      value?: string;
      sub_operator?: string;
      logical_op?: string;
    },
    req: NcRequest,
  ) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    // Normalize empty strings to null — LLMs often pass "" for optional fields,
    // but the swagger schema only accepts valid enum values or null.
    const value = args.value || null;
    const subOp = args.sub_operator || null;
    const logicalOp = args.logical_op || null;

    const filter = await filtersService.filterCreate(context, {
      viewId: view.id,
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
      message: `Filter added: "${args.field_name}" ${args.operator} ${
        args.value ?? ''
      }`.trim(),
      filter_id: filter.id,
    };
  },
};
