import { z } from 'zod';
import { ProjectRoles, ViewTypes } from 'nocodb-sdk';
import {
  resolveColumnByName,
  resolveGridViewColumnId,
  resolveTableByName,
  resolveViewByName,
} from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { GridColumnsService } from '~/services/grid-columns.service';
import Noco from '~/Noco';

export const setGroupByTool: ChatToolDefinition = {
  name: 'set_group_by',
  description:
    'Set group-by fields on a grid view, which visually groups records by one, two, or three field values. ' +
    'Only works on grid-type views — use list_views to confirm view type. ' +
    'This REPLACES any existing group-by settings (it calls clear_group_by internally first). ' +
    'To remove all grouping, use clear_group_by instead.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the grid view (case-insensitive).',
      ),
    view_name: z
      .string()
      .optional()
      .describe(
        'The title of the grid view to set group-by on. If omitted, uses the first (default) view. ' +
          'Must be a grid view — gallery/kanban/form/calendar views do not support group-by.',
      ),
    groups: z
      .array(
        z.object({
          field_name: z
            .string()
            .describe(
              'The title of the field to group by (case-insensitive). ' +
                'Works best with SingleSelect, MultiSelect, Checkbox, or other low-cardinality fields.',
            ),
          sort: z
            .enum(['asc', 'desc'])
            .optional()
            .describe('Sort order for the group headers. Default: "asc".'),
        }),
      )
      .min(1)
      .max(3)
      .describe(
        'List of 1-3 fields to group by, applied in order (primary group, secondary group, tertiary group). ' +
          'Example: [{ "field_name": "Status", "sort": "asc" }, { "field_name": "Priority", "sort": "desc" }]',
      ),
  },
  permission: 'gridColumnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      view_name?: string;
      groups: { field_name: string; sort?: string }[];
    },
    req: NcRequest,
  ) {
    const gridColumnsService: GridColumnsService =
      Noco.nestApp.get(GridColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    if (view.type !== ViewTypes.GRID) {
      return {
        message: `Group-by is only supported on grid views. "${view.title}" is not a grid view.`,
      };
    }

    // Clear existing group-by first
    await gridColumnsService.gridColumnClearGroupBy(context, {
      viewId: view.id,
    });

    // Set new group-by for each field
    const groupNames: string[] = [];
    for (let i = 0; i < args.groups.length; i++) {
      const group = args.groups[i];
      const column = await resolveColumnByName(
        context,
        model,
        group.field_name,
      );
      const gridViewColumnId = await resolveGridViewColumnId(
        context,
        view.id,
        column.id,
      );

      await gridColumnsService.gridColumnUpdate(context, {
        gridViewColumnId,
        grid: {
          group_by: true,
          group_by_order: i + 1,
          group_by_sort: group.sort || 'asc',
        },
        req,
      });

      groupNames.push(group.field_name);
    }

    return {
      message: `Grouped by: ${groupNames.join(' > ')} in view "${view.title}".`,
    };
  },
};
