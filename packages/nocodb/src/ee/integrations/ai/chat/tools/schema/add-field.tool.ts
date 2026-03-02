import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

export const addFieldTool: ChatToolDefinition = {
  name: 'add_field',
  description:
    'Add a new field (column) to an existing table. ' +
    'Valid types: SingleLineText, LongText, Email, URL, PhoneNumber, Number, Decimal, ' +
    'Currency, Percent, Duration, Rating, Date, DateTime, Time, Year, SingleSelect, MultiSelect, ' +
    'Checkbox, Attachment, JSON. ' +
    'Use describe_table first to verify the current field names and avoid duplicates. ' +
    'For SingleSelect and MultiSelect, pass choices as an array: [{ "title": "Option A" }, { "title": "Option B" }]. ' +
    'Returns the created field in v3 format.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table to add the field to (case-insensitive).',
      ),
    title: z
      .string()
      .describe(
        'The display name for the new field. Must be unique within the table.',
      ),
    type: z
      .string()
      .describe(
        'The field type. Must be one of the creatable types listed in the description. ' +
          'Examples: "SingleLineText", "Number", "Date", "SingleSelect", "Checkbox", "Email", "Currency".',
      ),
    choices: z
      .array(z.object({ title: z.string() }))
      .optional()
      .describe(
        'Required for SingleSelect and MultiSelect fields. ' +
          'Array of choice objects. Example: [{ "title": "Active" }, { "title": "Inactive" }, { "title": "Pending" }]',
      ),
  },
  permission: 'columnCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      title: string;
      type: string;
      choices?: { title: string }[];
    },
    req: NcRequest,
  ) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const column = await columnsV3Service.columnAdd(context, {
      tableId: model.id,
      column: {
        title: args.title,
        type: args.type as any,
        ...(args.choices ? { choices: args.choices } : {}),
      },
      req,
      user: (req as any).user,
    });

    return column;
  },
};
