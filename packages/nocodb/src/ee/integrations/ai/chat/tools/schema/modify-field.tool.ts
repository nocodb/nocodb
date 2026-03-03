import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

export const modifyFieldTool: ChatToolDefinition = {
  name: 'modify_field',
  description:
    'Modify an existing field: rename it, change its type, or update the choices for SingleSelect/MultiSelect. ' +
    'At least one of new_title, type, or choices must be provided. ' +
    'WARNING: Changing the field type may cause data loss if existing values are incompatible. ' +
    'For SingleSelect/MultiSelect, providing choices replaces the full option list — include ALL desired options, ' +
    'not just the new ones.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the field (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe('The current title of the field to modify (case-insensitive).'),
    new_title: z
      .string()
      .optional()
      .describe('New display name for the field. Omit if not renaming.'),
    type: z
      .string()
      .optional()
      .describe(
        'New field type (e.g. "LongText", "Number"). Omit if not changing.',
      ),
    choices: z
      .array(z.object({ title: z.string() }))
      .optional()
      .describe(
        'New complete choices list for SingleSelect/MultiSelect fields. ' +
          'This REPLACES all existing options — include every option you want to keep. ' +
          'Example: [{ "title": "Todo" }, { "title": "In Progress" }, { "title": "Done" }]',
      ),
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
      type?: string;
      choices?: { title: string }[];
    },
    req: NcRequest,
  ) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const updatePayload: any = {};
    if (args.new_title) updatePayload.title = args.new_title;
    if (args.type) updatePayload.type = args.type;
    if (args.choices) updatePayload.choices = args.choices;

    const result = await columnsV3Service.columnUpdate(context, {
      columnId: column.id,
      column: updatePayload,
      req,
      user: (req as any).user,
    });

    return result;
  },
};
