import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { GridColumnsService } from '~/services/grid-columns.service';
import Noco from '~/Noco';

export const clearGroupByTool = defineChatTool({
  name: ChatToolName.CLEAR_GROUP_BY,
  description:
    'Remove all group-by settings from a grid view, returning it to a flat ungrouped list. ' +
    'Only works on grid views. To change grouping instead of removing it, use set_group_by ' +
    '(it replaces existing groups automatically).',
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
        'The title of the grid view to clear group-by from. If omitted, uses the first (default) view.',
      ),
  }),
  permission: 'gridColumnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  visibility: 'action',
  category: 'view',
  async execute(context, args, _req) {
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
});
