import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

const COMPARISON_OPS = [
  'eq',
  'neq',
  'gt',
  'ge',
  'lt',
  'le',
  'like',
  'nlike',
  'is',
  'isnot',
  'in',
  'notin',
  'empty',
  'notempty',
  'null',
  'notnull',
  'isWithin',
  'btw',
  'nbtw',
  'allof',
  'nallof',
  'anyof',
  'nanyof',
  'gb_eq',
  'gb_null',
  'checked',
  'notchecked',
] as const;

export const addFilterTool: ChatToolDefinition = {
  name: 'add_filter',
  description:
    'Add a filter condition to a view. Common operators: eq (equals), neq (not equal), gt/lt (greater/less than), like (contains), empty/notempty, null/notnull, checked/notchecked.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    view_name: z
      .string()
      .optional()
      .describe('The name of the view. If omitted, uses the default view.'),
    field_name: z.string().describe('The name of the field to filter on'),
    operator: z.enum(COMPARISON_OPS).describe('The comparison operator'),
    value: z
      .string()
      .optional()
      .describe(
        'The filter value. Not needed for operators like empty, notempty, null, notnull, checked, notchecked.',
      ),
    logical_op: z
      .enum(['and', 'or'])
      .optional()
      .describe(
        'Logical operator to combine with existing filters. Defaults to "and".',
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
      logical_op?: string;
    },
    req: NcRequest,
  ) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const filter = await filtersService.filterCreate(context, {
      viewId: view.id,
      filter: {
        fk_column_id: column.id,
        comparison_op: args.operator as any,
        value: args.value ?? null,
        logical_op: args.logical_op as any,
      },
      user: (req as any).user,
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
