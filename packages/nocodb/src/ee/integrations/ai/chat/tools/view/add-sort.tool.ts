import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import Noco from '~/Noco';

export const addSortTool = defineChatTool({
  name: ChatToolName.ADD_SORT,
  description:
    'Add a sort rule to a view, controlling the order records are displayed. ' +
    'Multiple sort rules are applied in the order they were added (first sort has highest priority). ' +
    'Only one sort per field is allowed — use remove_sort then add_sort to change direction. ' +
    'Returns a sort_id that can be used with remove_sort to delete this sort later.',
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
        'The title of the view to add the sort to. If omitted, uses the first (default) view.',
      ),
    field_name: z
      .string()
      .describe('The title of the field to sort by (case-insensitive).'),
    direction: z
      .enum(['asc', 'desc'])
      .describe(
        '"asc" for ascending order (A→Z, 0→9, oldest→newest), ' +
          '"desc" for descending (Z→A, 9→0, newest→oldest).',
      ),
  }),
  permission: 'sortCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
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
});
