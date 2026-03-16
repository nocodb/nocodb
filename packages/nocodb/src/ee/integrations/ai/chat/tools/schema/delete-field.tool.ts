import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

export const deleteFieldTool = defineChatTool({
  name: ChatToolName.DELETE_FIELD,
  description:
    'Permanently delete a field (column) and all its data across every record. This CANNOT be undone. ' +
    'If the field is a Link/LTAR, the corresponding virtual column in the related table is also removed. ' +
    'The display field (primary field) cannot be deleted — use set_display_field to change it first. ' +
    'Call describe_table to verify the field name before deleting.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the field (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe('The title of the field to delete (case-insensitive).'),
  }),
  permission: 'columnDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    await columnsV3Service.columnDelete(context, {
      columnId: column.id,
      user: req.user,
      req,
    });

    return {
      message: `Field "${args.field_name}" has been permanently deleted from table "${args.table_name}".`,
    };
  },
});
