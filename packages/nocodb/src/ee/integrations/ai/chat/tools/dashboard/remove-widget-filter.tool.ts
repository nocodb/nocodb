import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

export const removeWidgetFilterTool: ChatToolDefinition = {
  name: 'remove_widget_filter',
  description:
    'Remove a specific filter condition from a widget by its ID. ' +
    'Call list_widget_filters first to get the filter ID of the filter you want to remove.',
  parameters: {
    filter_id: z
      .string()
      .describe(
        'The ID of the filter to remove. Get this from list_widget_filters — it is the "id" field in the response.',
      ),
  },
  permission: 'filterDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { filter_id: string },
    req: NcRequest,
  ) {
    const filtersService: FiltersService = Noco.nestApp.get(FiltersService);

    await filtersService.filterDelete(context, {
      filterId: args.filter_id,
      req,
    });

    return {
      message: `Widget filter ${args.filter_id} removed.`,
    };
  },
};
