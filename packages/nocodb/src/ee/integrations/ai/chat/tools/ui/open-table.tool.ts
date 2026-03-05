import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const openTableTool: ChatToolDefinition = {
  name: 'open_table',
  description:
    'Open a table in the UI. Navigates the user to the specified table in the current base.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table to open (case-insensitive).'),
  },
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { table_name: string },
    _req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);

    return {
      __ui_action: 'open_table',
      base_id: context.base_id,
      table_id: model.id,
      message: `Opening table "${model.title}".`,
    };
  },
};
