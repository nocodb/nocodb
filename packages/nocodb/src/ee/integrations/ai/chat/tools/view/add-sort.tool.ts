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
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import Noco from '~/Noco';

export const addSortTool: ChatToolDefinition = {
  name: 'add_sort',
  description:
    'Add a sort rule to a view, controlling the order records are displayed. ' +
    'Multiple sort rules are applied in the order they were added (first sort has highest priority). ' +
    'Only one sort per field is allowed — use remove_sort then add_sort to change direction. ' +
    'Returns a sort_id that can be used with remove_sort to delete this sort later.',
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
        'The title of the view to add the sort to. If omitted, uses the first (default) view.',
      ),
    field_name: z
      .string()
      .describe(
        'The title of the field to sort by (case-insensitive). ' +
          'Use describe_table to see available field names.',
      ),
    direction: z
      .enum(['asc', 'desc'])
      .describe(
        '"asc" for ascending order (A→Z, 0→9, oldest→newest), ' +
          '"desc" for descending (Z→A, 9→0, newest→oldest).',
      ),
  },
  permission: 'sortCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      view_name?: string;
      field_name: string;
      direction: string;
    },
    req: NcRequest,
  ) {
    const sortsV3Service: SortsV3Service = Noco.nestApp.get(SortsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const sort = await sortsV3Service.sortCreate(context, {
      viewId: view.id,
      sort: {
        field_id: column.id,
        direction: args.direction as 'asc' | 'desc',
      },
      req,
    });

    return {
      message: `Sort added: "${args.field_name}" ${
        args.direction === 'desc' ? 'descending' : 'ascending'
      }.`,
      sort_id: sort.id,
    };
  },
};
