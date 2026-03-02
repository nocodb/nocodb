import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const createTableTool: ChatToolDefinition = {
  name: 'create_table',
  description:
    'Create a new table in the base, optionally with initial fields. ' +
    'An ID column (auto-incrementing primary key) is always added automatically — do not include it. ' +
    'Valid types for fields: SingleLineText, LongText, Email, URL, PhoneNumber, Number, Decimal, ' +
    'Currency, Percent, Duration, Rating, Date, DateTime, Time, Year, SingleSelect, MultiSelect, ' +
    'Checkbox, Attachment, JSON. ' +
    'For SingleSelect and MultiSelect, pass choices as an array of objects: ' +
    '[{ "title": "Option A" }, { "title": "Option B" }]. ' +
    'If fields are omitted, only the ID column is created and fields can be added later with add_field.',
  parameters: {
    title: z
      .string()
      .describe(
        'The display name of the new table. Must be unique within the base.',
      ),
    fields: z
      .array(
        z.object({
          title: z.string().describe('The display name of the field.'),
          type: z
            .string()
            .describe(
              'The field type. Must be one of the creatable types listed in the description. ' +
                'Example: "SingleLineText", "Number", "SingleSelect", "Date".',
            ),
          choices: z
            .array(z.object({ title: z.string() }))
            .optional()
            .describe(
              'Required for SingleSelect and MultiSelect fields. ' +
                'Array of choice objects. Example: [{ "title": "Active" }, { "title": "Inactive" }]',
            ),
        }),
      )
      .optional()
      .describe(
        'Optional list of fields to create with the table. Do not include an ID field — it is added automatically.',
      ),
  },
  permission: 'tableCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      title: string;
      fields?: Array<{
        title: string;
        type: string;
        choices?: { title: string }[];
      }>;
    },
    req: NcRequest,
  ) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);

    const table = await tablesV3Service.tableCreate(context, {
      baseId: context.base_id,
      table: {
        title: args.title,
        fields: (args.fields || []).map((f) => ({
          title: f.title,
          type: f.type as any,
          ...(f.choices ? { choices: f.choices } : {}),
        })),
      },
      user: (req as any).user,
      req,
    });

    return {
      id: table.id,
      title: table.title,
      message: `Table "${table.title}" created successfully.`,
    };
  },
};
