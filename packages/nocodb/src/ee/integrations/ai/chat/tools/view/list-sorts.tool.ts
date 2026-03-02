import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { SortsService } from '~/services/sorts.service';
import Noco from '~/Noco';

export const listSortsTool: ChatToolDefinition = {
  name: 'list_sorts',
  description:
    "List all sort rules currently applied to a view. Returns each sort's id (needed for remove_sort), " +
    'field name, and direction (asc/desc). Sorts are applied in the order shown.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the view (case-insensitive).',
      ),
    view_name: z
      .string()
      .optional()
      .describe(
        'The title of the view to list sorts for. If omitted, uses the first (default) view.',
      ),
  },
  permission: 'sortList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name?: string },
    _req: NcRequest,
  ) {
    const sortsService: SortsService = Noco.nestApp.get(SortsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const columns = await model.getColumns(context);

    const sorts = await sortsService.sortList(context, {
      viewId: view.id,
    });

    const colMap = new Map(columns.map((c) => [c.id, c.title]));

    return (sorts as any[]).map((s) => ({
      id: s.id,
      field_name: colMap.get(s.fk_column_id) || s.fk_column_id,
      direction: s.direction,
    }));
  },
};
