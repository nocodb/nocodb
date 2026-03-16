import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ViewColumnsService } from '~/services/view-columns.service';
import Noco from '~/Noco';

export const listViewFieldsTool = defineChatTool({
  name: ChatToolName.LIST_VIEW_FIELDS,
  description:
    'List all fields in a view with their visibility (shown/hidden) and display order. ' +
    'Returns field_name, visible (boolean), and order for each field. ' +
    'Use this before update_view_fields to see current visibility. ' +
    'Hidden fields still store data — hiding only affects the view display.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the view (case-insensitive).',
      ),
    view_name: z
      .string()
      .optional()
      .describe(
        'The title of the view to inspect. If omitted, uses the first (default) view of the table.',
      ),
  }),
  permission: 'viewColumnList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'view',
  async execute(context, args, _req) {
    const viewColumnsService: ViewColumnsService =
      Noco.nestApp.get(ViewColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const columns = await model.getColumns(context);

    const viewColumns = await viewColumnsService.columnList(context, {
      viewId: view.id,
    });

    const colMap = new Map(columns.map((c) => [c.id, c.title]));

    return (viewColumns as any[]).map((vc) => ({
      field_name: colMap.get(vc.fk_column_id) || vc.fk_column_id,
      visible: !!vc.show,
      order: vc.order,
    }));
  },
});
