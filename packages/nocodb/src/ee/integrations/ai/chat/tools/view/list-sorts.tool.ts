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

export const listSortsTool = defineChatTool({
  name: ChatToolName.LIST_SORTS,
  description:
    'List all sort rules applied to a view in V3 format. ' +
    "Returns each sort's id (needed for remove_sort), field_id, and direction (asc/desc). " +
    'Sorts are applied in priority order (first sort = primary). ' +
    'Use this before remove_sort to find the sort ID, or before add_sort to see existing sort rules.',
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
        'The title of the view to list sorts for. If omitted, uses the first (default) view.',
      ),
  }),
  permission: 'sortList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'view',
  async execute(context, args, _req) {
    const sortsV3Service: SortsV3Service = Noco.nestApp.get(SortsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    return await sortsV3Service.sortList(context, {
      viewId: view.id,
    });
  },
});
