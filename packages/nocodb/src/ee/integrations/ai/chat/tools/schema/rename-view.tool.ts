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

export const renameViewTool = defineChatTool({
  name: ChatToolName.RENAME_VIEW,
  description:
    'Rename a view. Only changes the display title — filters, sorts, field visibility, group-by, and data are preserved. ' +
    'The new name must be unique within the table.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the view (case-insensitive).',
      ),
    view_name: z
      .string()
      .describe(
        'The current title of the view to rename (case-insensitive). ' +
          'Use list_views to see available view names.',
      ),
    new_name: z
      .string()
      .describe(
        'The new display name for the view. Must be unique within the table.',
      ),
  }),
  permission: 'viewUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const viewsService: ViewsService = Noco.nestApp.get(ViewsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await viewsService.viewUpdate(context, {
      viewId: view.id,
      view: { title: args.new_name },
      user: req.user,
      req,
    });

    return {
      message: `View "${args.view_name}" on table "${args.table_name}" has been renamed to "${args.new_name}".`,
    };
  },
});
