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
import { SortsService } from '~/services/sorts.service';
import Noco from '~/Noco';

export const addSortTool: ChatToolDefinition = {
  name: 'add_sort',
  description:
    'Add a sort rule to a view. Records will be ordered by the specified field.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    view_name: z
      .string()
      .optional()
      .describe('The name of the view. If omitted, uses the default view.'),
    field_name: z.string().describe('The name of the field to sort by'),
    direction: z
      .enum(['asc', 'desc'])
      .describe('Sort direction: "asc" for ascending, "desc" for descending'),
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
    const sortsService: SortsService = Noco.nestApp.get(SortsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const sort = await sortsService.sortCreate(context, {
      viewId: view.id,
      sort: {
        fk_column_id: column.id,
        direction: args.direction as any,
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
