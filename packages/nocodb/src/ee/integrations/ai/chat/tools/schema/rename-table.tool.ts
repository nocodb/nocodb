import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveTableByName } from '~/integrations/ai/chat/tools/helpers';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const renameTableTool = defineChatTool({
  name: ChatToolName.RENAME_TABLE,
  description:
    'Update a table title or description. All data, fields, views, and links are preserved. ' +
    'The new name must be unique within the base. ' +
    'Link/LTAR fields in other tables that reference this table are NOT affected.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The current title of the table to update (case-insensitive).'),
    new_name: z
      .string()
      .optional()
      .describe(
        'New display name for the table. Must be unique within the base. Omit if only updating description.',
      ),
    description: z
      .string()
      .nullable()
      .optional()
      .describe('New description for the table. Pass null to clear.'),
  }),
  permission: 'tableUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const updatePayload: Record<string, any> = {};
    if (args.new_name) updatePayload.title = args.new_name;
    if (args.description !== undefined)
      updatePayload.description = args.description;

    await tablesV3Service.tableUpdate(context, {
      tableId: model.id,
      table: updatePayload,
      user: req.user,
      req,
    });

    return {
      message: args.new_name
        ? `Table "${args.table_name}" has been renamed to "${args.new_name}".`
        : `Table "${args.table_name}" has been updated.`,
    };
  },
});
