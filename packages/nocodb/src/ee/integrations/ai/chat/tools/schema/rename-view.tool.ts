import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ViewsService } from '~/services/views.service';
import Noco from '~/Noco';

export const renameViewTool: ChatToolDefinition = {
  name: 'rename_view',
  description:
    'Rename a view. Only changes the display name — filters, sorts, field visibility, and data are preserved.',
  parameters: {
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
  },
  permission: 'viewUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name: string; new_name: string },
    req: NcRequest,
  ) {
    const viewsService: ViewsService = Noco.nestApp.get(ViewsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await viewsService.viewUpdate(context, {
      viewId: view.id,
      view: { title: args.new_name },
      user: (req as any).user,
      req,
    });

    return {
      message: `View "${args.view_name}" on table "${args.table_name}" has been renamed to "${args.new_name}".`,
    };
  },
};
