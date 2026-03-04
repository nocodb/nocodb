import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const renameTableTool: ChatToolDefinition = {
  name: 'rename_table',
  description:
    'Rename a table. Only changes the display name — all data, fields, and views are preserved. ' +
    'The new name must be unique within the base.',
  parameters: {
    table_name: z
      .string()
      .describe('The current title of the table to rename (case-insensitive).'),
    new_name: z
      .string()
      .describe(
        'The new display name for the table. Must be unique within the base.',
      ),
  },
  permission: 'tableUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; new_name: string },
    req: NcRequest,
  ) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);
    const model = await resolveTableByName(context, args.table_name);

    await tablesV3Service.tableUpdate(context, {
      tableId: model.id,
      table: { title: args.new_name },
      user: req.user,
      req,
    });

    return {
      message: `Table "${args.table_name}" has been renamed to "${args.new_name}".`,
    };
  },
};
