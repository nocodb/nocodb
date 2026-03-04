import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsService } from '~/services/columns.service';
import Noco from '~/Noco';

export const setDisplayFieldTool: ChatToolDefinition = {
  name: 'set_display_field',
  description:
    'Set the primary display field (title field) for a table. The display field is the main ' +
    'identifier shown in linked record pickers and relationship columns when records from this table ' +
    'are referenced elsewhere. Only SingleLineText, Number, Email, URL, Date, DateTime, and similar ' +
    'simple text-compatible fields can be set as display fields.',
  parameters: {
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
  },
  permission: 'columnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; field_name: string },
    req: NcRequest,
  ) {
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
};
