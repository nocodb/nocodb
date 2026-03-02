import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

export const listFiltersTool: ChatToolDefinition = {
  name: 'list_filters',
  description:
    'List all active filter conditions on a view. Returns filter IDs needed for removal.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    view_name: z
      .string()
      .optional()
      .describe('The name of the view. If omitted, uses the default view.'),
  },
  permission: 'filterList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name?: string },
    _req: NcRequest,
  ) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);
    const columns = await model.getColumns(context);

    const filters = await filtersService.filterList(context, {
      viewId: view.id,
    });

    const colMap = new Map(columns.map((c) => [c.id, c.title]));

    return (filters as any[]).map((f) => ({
      id: f.id,
      field_name: colMap.get(f.fk_column_id) || f.fk_column_id,
      operator: f.comparison_op,
      value: f.value,
      logical_op: f.logical_op || 'and',
    }));
  },
};
