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
    "List all active filter conditions on a view. Returns each filter's id (needed for remove_filter), " +
    'field name, operator, value, and logical_op (and/or). ' +
    'Use this before remove_filter to find the filter ID to remove.',
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
        'The title of the view to list filters for. If omitted, uses the first (default) view.',
      ),
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
