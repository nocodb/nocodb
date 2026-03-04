import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveViewByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { GridColumnsService } from '~/services/grid-columns.service';
import Noco from '~/Noco';

export const clearGroupByTool: ChatToolDefinition = {
  name: 'clear_group_by',
  description:
    'Remove all group-by settings from a grid view, returning it to ungrouped flat list display. ' +
    'Only works on grid-type views.',
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
        'The title of the grid view to clear group-by from. If omitted, uses the first (default) view.',
      ),
  },
  permission: 'gridColumnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string; view_name?: string },
    _req: NcRequest,
  ) {
    const gridColumnsService: GridColumnsService =
      Noco.nestApp.get(GridColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await gridColumnsService.gridColumnClearGroupBy(context, {
      viewId: view.id,
    });

    return {
      message: `All group-by settings cleared from view "${view.title}".`,
    };
  },
};
