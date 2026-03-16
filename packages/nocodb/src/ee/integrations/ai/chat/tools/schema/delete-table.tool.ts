import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveTableByName } from '~/integrations/ai/chat/tools/helpers';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const deleteTableTool = defineChatTool({
  name: ChatToolName.DELETE_TABLE,
  description:
    'Permanently delete a table and ALL its data, fields, views, and relationship links. This CANNOT be undone. ' +
    'Also removes Link/LTAR columns in other tables that referenced this table. ' +
    'Call list_tables to verify the table name before deleting.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The exact title of the table to delete (case-insensitive). ' +
          'Use list_tables to confirm the table exists before deleting.',
      ),
  }),
  permission: 'tableDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);
    const model = await resolveTableByName(context, args.table_name);

    await tablesV3Service.tableDelete(context, {
      tableId: model.id,
      user: req.user,
      forceDeleteRelations: true,
      req,
    });

    return {
      message: `Table "${args.table_name}" has been permanently deleted.`,
    };
  },
});
