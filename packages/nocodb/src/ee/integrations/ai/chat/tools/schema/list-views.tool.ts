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
  description: 'List all views for a given table.',
  parameters: {
    table_name: z.string().describe('The name of the table to list views for'),
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
