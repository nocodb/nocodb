import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ViewsService } from '~/services/views.service';
import Noco from '~/Noco';

export const deleteViewTool = defineChatTool({
  name: ChatToolName.DELETE_VIEW,
  description:
    'Delete a view and its configuration (filters, sorts, field visibility, group-by). ' +
    'Data is NOT deleted — only the view is removed. ' +
    'The default view (is_default: true) cannot be deleted. ' +
    'Call list_views first to see available views and confirm the name.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the view (case-insensitive).',
      ),
    view_name: z
      .string()
      .describe(
        'The title of the view to delete (case-insensitive). ' +
          'Use list_views to see available view names.',
      ),
  }),
  permission: 'viewDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const viewsService: ViewsService = Noco.nestApp.get(ViewsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await viewsService.viewDelete(context, {
      viewId: view.id,
      user: req.user,
      req,
    });

    return {
      message: `View "${args.view_name}" has been deleted from table "${args.table_name}".`,
    };
  },
});
