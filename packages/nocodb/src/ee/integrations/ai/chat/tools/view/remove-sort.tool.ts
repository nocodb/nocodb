import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import Noco from '~/Noco';

export const removeSortTool = defineChatTool({
  name: ChatToolName.REMOVE_SORT,
  description:
    'Remove a sort rule from a view by its ID. ' +
    'Call list_sorts first to get the sort ID you want to remove. ' +
    'After removal, remaining sorts shift in priority order.',
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
        'The title of the view to remove the sort from. If omitted, uses the first (default) view.',
      ),
    sort_id: z
      .string()
      .describe(
        'The ID of the sort to remove. Get this from list_sorts — it is the "id" field in the response.',
      ),
  }),
  permission: 'sortDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
    const sortsV3Service: SortsV3Service = Noco.nestApp.get(SortsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await sortsV3Service.sortDelete(context, {
      viewId: view.id,
      sortId: args.sort_id,
      req,
    });

    return {
      message: `Sort ${args.sort_id} removed.`,
    };
  },
});
