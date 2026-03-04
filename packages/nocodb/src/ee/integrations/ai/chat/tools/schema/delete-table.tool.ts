import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const deleteTableTool: ChatToolDefinition = {
  name: 'delete_table',
  description:
    'Permanently delete a table and ALL of its data, fields, views, and relationship links. ' +
    'This CANNOT be undone. ' +
    'Also removes any LinkToAnotherRecord/Links columns in other tables that pointed to this table.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The exact title of the table to delete (case-insensitive). ' +
          'Use list_tables to confirm the table exists before deleting.',
      ),
  },
  permission: 'tableDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string },
    req: NcRequest,
  ) {
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
};
