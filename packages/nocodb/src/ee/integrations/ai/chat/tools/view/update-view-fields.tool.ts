import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import {
  resolveColumnByName,
  resolveTableByName,
  resolveViewByName,
} from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ViewColumnsService } from '~/services/view-columns.service';
import View from '~/models/View';
import Noco from '~/Noco';

export const updateViewFieldsTool: ChatToolDefinition = {
  name: 'update_view_fields',
  description:
    'Show or hide fields in a view. Provide a list of field changes to apply in bulk.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    view_name: z
      .string()
      .optional()
      .describe('The name of the view. If omitted, uses the default view.'),
    fields: z
      .array(
        z.object({
          field_name: z.string().describe('The name of the field'),
          visible: z.boolean().describe('Whether the field should be visible'),
        }),
      )
      .describe('List of fields to show or hide'),
  },
  permission: 'viewColumnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      view_name?: string;
      fields: { field_name: string; visible: boolean }[];
    },
    req: NcRequest,
  ) {
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
};
