import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

export const deleteFieldTool: ChatToolDefinition = {
  name: 'delete_field',
  description:
    'Permanently delete a field (column) from a table, including all data stored in that field across all records. ' +
    'This CANNOT be undone.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the field (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe('The title of the field to delete (case-insensitive).'),
  },
  permission: 'columnDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string; field_name: string },
    req: NcRequest,
  ) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    await columnsV3Service.columnDelete(context, {
      columnId: column.id,
      user: (req as any).user,
      req,
    });

    return {
      message: `Field "${args.field_name}" has been permanently deleted from table "${args.table_name}".`,
    };
  },
};
