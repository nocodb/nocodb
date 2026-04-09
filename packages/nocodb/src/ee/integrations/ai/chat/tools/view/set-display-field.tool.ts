import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ColumnsService } from '~/services/columns.service';
import Noco from '~/Noco';

export const setDisplayFieldTool = defineChatTool({
  name: ChatToolName.SET_DISPLAY_FIELD,
  description:
    'Set the primary display field (title field) for a table. ' +
    'The display field is the main identifier shown in linked record pickers, expanded row headers, ' +
    'and relationship columns when records from this table are referenced elsewhere.\n\n' +
    'Any non-system field can be a display field, but text-based fields work best: ' +
    'SingleLineText, Email, URL, PhoneNumber, Number, Date, DateTime.\n\n' +
    'IMPORTANT: The field must already exist in the table. Call describe_table first to verify ' +
    'the exact field name. Field names are case-insensitive. ' +
    'This is a table-level setting — it affects all views of the table.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table to set the display field on (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe(
        'The title of the field to make the primary display field (case-insensitive). ' +
          'Must be a text-compatible field (SingleLineText, Email, URL, Number, etc.).',
      ),
  }),
  permission: 'columnSetAsPrimary',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
    const columnsService: ColumnsService = Noco.nestApp.get(ColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    await columnsService.columnSetAsPrimary(context, {
      columnId: column.id,
      req,
    });

    return {
      message: `"${args.field_name}" is now the display field for table "${args.table_name}".`,
    };
  },
});
