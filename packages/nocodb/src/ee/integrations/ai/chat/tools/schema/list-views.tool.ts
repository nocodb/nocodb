import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveTableByName } from '~/integrations/ai/chat/tools/helpers';
import { ViewsV3Service } from '~/services/v3/views-v3.service';
import Noco from '~/Noco';

export const listViewsTool = defineChatTool({
  name: ChatToolName.LIST_VIEWS,
  description:
    'List all views of a table. Returns id, title, type (grid/gallery/kanban/form/calendar), ' +
    'lock_type, and description for each view in V3 format. ' +
    'Use this to discover available views before add_filter, add_sort, set_group_by, ' +
    'update_view_fields, open_view, or delete_view.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table to list views for (case-insensitive).'),
  }),
  permission: 'viewList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'schema',
  async execute(context, args, req) {
    const viewsV3Service: ViewsV3Service = Noco.nestApp.get(ViewsV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const views = await viewsV3Service.getViews(context, {
      tableId: model.id,
      req,
    });

    return views.map((v: any) => ({
      id: v.id,
      table_id: model.id,
      title: v.title,
      type: v.type,
      lock_type: v.lock_type || 'collaborative',
      description: v.description || null,
    }));
  },
});
