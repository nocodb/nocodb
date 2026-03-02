import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ViewColumnsService } from '~/services/view-columns.service';
import Noco from '~/Noco';

export const listViewFieldsTool: ChatToolDefinition = {
  name: 'list_view_fields',
  description:
    'List all fields in a view with their visibility status and display order. Use this to see which fields are shown or hidden.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    view_name: z
      .string()
      .optional()
      .describe('The name of the view. If omitted, uses the default view.'),
  },
  permission: 'viewColumnList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name?: string },
    _req: NcRequest,
  ) {
    const viewColumnsService: ViewColumnsService =
      Noco.nestApp.get(ViewColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const columns = await model.getColumns(context);

    const viewColumns = await viewColumnsService.columnList(context, {
      viewId: view.id,
    });

    // Build a map of column ID to title for readable output
    const colMap = new Map(columns.map((c) => [c.id, c.title]));

    return (viewColumns as any[]).map((vc) => ({
      field_name: colMap.get(vc.fk_column_id) || vc.fk_column_id,
      visible: !!vc.show,
      order: vc.order,
    }));
  },
};
