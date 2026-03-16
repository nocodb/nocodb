import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';

export const openViewTool = defineChatTool({
  name: ChatToolName.OPEN_VIEW,
  description:
    'Navigate the user to a specific view of a table. ' +
    'Use this after creating a view or applying filters/sorts to show the result. ' +
    'Call list_views first to discover available views and their names.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table (case-insensitive).'),
    view_name: z
      .string()
      .describe('The title of the view to open (case-insensitive).'),
  }),
  permission: 'viewList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  uiOnly: true,
  visibility: 'ui',
  category: 'ui',
  async execute(context, args, _req) {
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
});
