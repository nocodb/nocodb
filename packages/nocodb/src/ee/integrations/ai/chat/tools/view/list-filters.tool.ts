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

export const listFiltersTool = defineChatTool({
  name: ChatToolName.LIST_FILTERS,
  description:
    'List all active filter conditions on a view in V3 format. ' +
    "Returns each filter's id (needed for remove_filter), field_id, operator, sub_operator, and value. " +
    'Filters are returned as a nested tree — groups contain children filters with logical operators. ' +
    'Use this before remove_filter to find the filter ID to remove, or before add_filter to see existing conditions.',
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
        'The title of the view to list filters for. If omitted, uses the first (default) view.',
      ),
  }),
  permission: 'filterList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'view',
  async execute(context, args, _req) {
    const filtersV3Service: FiltersV3Service =
      Noco.nestApp.get(FiltersV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    return await filtersV3Service.filterList(context, {
      viewId: view.id,
    });
  },
});
