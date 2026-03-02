import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { SortsService } from '~/services/sorts.service';
import Noco from '~/Noco';

export const removeSortTool: ChatToolDefinition = {
  name: 'remove_sort',
  description:
    'Remove a sort rule from a view by its ID. Use list_sorts first to find the sort ID.',
  parameters: {
    sort_id: z
      .string()
      .describe('The ID of the sort to remove (from list_sorts)'),
  },
  permission: 'sortDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(context: NcContext, args: { sort_id: string }, req: NcRequest) {
    const sortsService: SortsService = Noco.nestApp.get(SortsService);

    await sortsService.sortDelete(context, {
      sortId: args.sort_id,
      req,
    });

    return {
      message: `Sort ${args.sort_id} removed.`,
    };
  },
};
