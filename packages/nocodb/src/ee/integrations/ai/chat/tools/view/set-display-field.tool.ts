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
    'Set a field as the primary display value for a table. The display field is shown when records are referenced in linked fields.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    field_name: z
      .string()
      .describe('The name of the field to set as the display field'),
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
