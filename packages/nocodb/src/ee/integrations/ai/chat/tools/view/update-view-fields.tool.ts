import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ViewColumnsService } from '~/services/view-columns.service';
import View from '~/models/View';
import Noco from '~/Noco';

export const updateViewFieldsTool = defineChatTool({
  name: ChatToolName.UPDATE_VIEW_FIELDS,
  description:
    'Show or hide fields in a view. This only controls visibility — data is NOT deleted. ' +
    'Each view has independent field visibility settings. ' +
    'Call list_view_fields first to see current visibility before making changes. ' +
    'Fields not included in this call remain unchanged. ' +
    'The display field (primary field) is always visible and cannot be hidden.',
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
        'The title of the view to update. If omitted, uses the first (default) view.',
      ),
    fields: z
      .array(
        z.object({
          field_name: z
            .string()
            .describe(
              'The title of the field to show/hide (case-insensitive).',
            ),
          visible: z
            .boolean()
            .describe('true to show the field in this view, false to hide it.'),
        }),
      )
      .describe(
        'List of fields to update with their desired visibility. ' +
          'Example: [{ "field_name": "Internal Notes", "visible": false }, { "field_name": "Status", "visible": true }]',
      ),
  }),
  permission: 'viewColumnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  visibility: 'action',
  category: 'view',
  async execute(context, args, req) {
    const viewColumnsService: ViewColumnsService =
      Noco.nestApp.get(ViewColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const view = await resolveViewByName(context, model, args.view_name);

    const updated: string[] = [];

    for (const field of args.fields) {
      const column = await resolveColumnByName(
        context,
        model,
        field.field_name,
      );

      const viewColumnId = await View.getViewColumnId(context, {
        viewId: view.id,
        colId: column.id,
      });

      if (viewColumnId) {
        await viewColumnsService.columnUpdate(context, {
          viewId: view.id,
          columnId: viewColumnId,
          column: { show: field.visible },
          req,
        });
        updated.push(
          `${field.field_name}: ${field.visible ? 'shown' : 'hidden'}`,
        );
      }
    }

    return {
      message: `Updated ${updated.length} field(s) in view "${view.title}".`,
      changes: updated,
    };
  },
});
