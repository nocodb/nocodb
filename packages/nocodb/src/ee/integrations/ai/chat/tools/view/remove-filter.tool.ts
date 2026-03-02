import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { FiltersService } from '~/services/filters.service';
import Noco from '~/Noco';

export const removeFilterTool: ChatToolDefinition = {
  name: 'remove_filter',
  description:
    'Remove a filter from a view by its ID. Use list_filters first to find the filter ID.',
  parameters: {
    filter_id: z
      .string()
      .describe('The ID of the filter to remove (from list_filters)'),
  },
  permission: 'filterDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
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
      message: `Filter ${args.filter_id} removed.`,
    };
  },
};
