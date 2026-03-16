import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

export const removeWidgetFilterTool = defineChatTool({
  name: ChatToolName.REMOVE_WIDGET_FILTER,
  description:
    'Remove a filter from a widget by its ID. ' +
    'Call list_widget_filters first to get the filter ID you want to remove. ' +
    'This only affects the widget display — underlying data is untouched.',
  schema: z.object({
    filter_id: z
      .string()
      .describe(
        'The ID of the filter to remove. Get this from list_widget_filters — it is the "id" field in the response.',
      ),
  }),
  permission: 'filterDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  visibility: 'action',
  category: 'dashboard',
  async execute(context, args, req) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);

    await filtersService.filterDelete(context, {
      filterId: args.filter_id,
      req,
    });

    return {
      message: `Widget filter ${args.filter_id} removed.`,
    };
  },
});
