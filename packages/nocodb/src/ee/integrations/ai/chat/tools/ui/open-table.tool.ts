import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveTableByName } from '~/integrations/ai/chat/tools/helpers';

export const openTableTool = defineChatTool({
  name: ChatToolName.OPEN_TABLE,
  description:
    'Navigate the user to a table in the current base. ' +
    'Opens the default (first) view of the table. ' +
    'Use open_view instead if you need to open a specific view.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table to open (case-insensitive).'),
  }),
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  uiOnly: true,
  visibility: 'ui',
  category: 'ui',
  async execute(context, args, _req) {
    const model = await resolveTableByName(context, args.table_name);

    return {
      __ui_action: 'open_table',
      base_id: context.base_id,
      table_id: model.id,
      message: `Opening table "${model.title}".`,
    };
  },
});
