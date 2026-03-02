import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ViewsService } from '~/services/views.service';
import Noco from '~/Noco';

export const listViewsTool: ChatToolDefinition = {
  name: 'list_views',
  description:
    'List all views of a table with their id, title, type (grid/gallery/kanban/form/calendar), and whether they are the default view. ' +
    'Use this before add_filter, add_sort, set_group_by, or delete_view to see which views exist ' +
    'and to find the correct view name. The default view (is_default: true) cannot be deleted.',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table to list views for (case-insensitive).'),
  },
  permission: 'viewList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string },
    req: NcRequest,
  ) {
    const viewsService: ViewsService = Noco.nestApp.get(ViewsService);
    const model = await resolveTableByName(context, args.table_name);

    const views = await viewsService.viewList(context, {
      tableId: model.id,
      user: (req as any).user,
    });

    return views.map((v: any) => ({
      id: v.id,
      title: v.title,
      type: v.type,
      is_default: v.is_default || false,
    }));
  },
};
