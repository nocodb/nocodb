import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ViewsService } from '~/services/views.service';
import Noco from '~/Noco';

export const deleteViewTool: ChatToolDefinition = {
  name: 'delete_view',
  description:
    'Delete a view from a table. The view and its filters, sorts, and field settings are removed. ' +
    'The underlying data is NOT deleted — only the view configuration. ' +
    'The default (first/primary) view of a table cannot be deleted. ' +
    'Use list_views to see what views exist before deleting.',
  parameters: {
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
  },
  permission: 'viewDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name: string },
    req: NcRequest,
  ) {
    const viewsService: ViewsService = Noco.nestApp.get(ViewsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await viewsService.viewDelete(context, {
      viewId: view.id,
      user: (req as any).user,
      req,
    });

    return {
      message: `View "${args.view_name}" has been deleted from table "${args.table_name}".`,
    };
  },
};
