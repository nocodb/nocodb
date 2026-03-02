import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsService } from '~/services/columns.service';
import Noco from '~/Noco';

export const modifyFieldTool: ChatToolDefinition = {
  name: 'modify_field',
  description:
    'Update the properties of an existing field (rename, change type, update options).',
  parameters: {
    table_name: z
      .string()
      .describe('The name of the table containing the field'),
    field_name: z.string().describe('Current name of the field to modify'),
    new_title: z
      .string()
      .optional()
      .describe('New name for the field (if renaming)'),
    uidt: z.string().optional().describe('New field type (if changing type)'),
    dtxp: z
      .string()
      .optional()
      .describe('New options for select fields (comma-separated)'),
  },
  permission: 'columnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      field_name: string;
      new_title?: string;
      uidt?: string;
      dtxp?: string;
    },
    req: NcRequest,
  ) {
    const columnsService: ColumnsService = Noco.nestApp.get(ColumnsService);
    const model = await resolveTableByName(context, args.table_name);
    const columns = await model.getColumns(context);
    const column = columns.find(
      (c) => c.title?.toLowerCase() === args.field_name.toLowerCase(),
    );

    if (!column) {
      throw new Error(
        `Field "${args.field_name}" not found in table "${args.table_name}"`,
      );
    }

    const updatePayload: any = {};
    if (args.new_title) updatePayload.title = args.new_title;
    if (args.uidt) updatePayload.uidt = args.uidt;
    if (args.dtxp) updatePayload.dtxp = args.dtxp;

    await columnsService.columnUpdate(context, {
      columnId: column.id,
      column: updatePayload,
      req,
      user: (req as any).user,
    });

    return {
      message: `Field "${args.field_name}" in table "${args.table_name}" updated successfully.`,
    };
  },
};
