import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import Noco from '~/Noco';

export const removeFilterTool = defineChatTool({
  name: ChatToolName.REMOVE_FILTER,
  description:
    'Remove a filter condition from a view by its ID, or remove all filters at once. ' +
    'Call list_filters first to get the filter ID you want to remove. ' +
    'Pass filter_id as "root" to clear all filters from the view. ' +
    'This only affects the view — underlying data is untouched.',
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
        'The title of the view to remove the filter from. If omitted, uses the first (default) view.',
      ),
    filter_id: z
      .string()
      .describe(
        'The ID of the filter to remove. Get this from list_filters — it is the "id" field in the response. ' +
          'Pass "root" to remove all filters from the view.',
      ),
  }),
  permission: 'filterDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
    const filtersV3Service: FiltersV3Service =
      Noco.nestApp.get(FiltersV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    await filtersV3Service.filterDelete(context, {
      viewId: view.id,
      filterId: args.filter_id,
      req,
    });

    return {
      message: `Filter ${args.filter_id} removed.`,
    };
  },
});
