import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const openViewTool: ChatToolDefinition = {
  name: 'open_view',
  description:
    'Open a specific view of a table in the UI. ' +
    'Use list_views to find available views first.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table (case-insensitive).'),
    view_name: z
      .string()
      .describe('The title of the view to open (case-insensitive).'),
  },
  permission: 'viewList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name: string },
    _req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    return {
      __ui_action: 'open_view',
      base_id: context.base_id,
      table_id: model.id,
      view_id: view.id,
      message: `Opening view "${view.title}" on table "${model.title}".`,
    };
  },
};
