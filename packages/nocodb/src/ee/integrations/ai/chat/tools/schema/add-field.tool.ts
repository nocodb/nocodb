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
    'Checkbox, Attachment, JSON, LinkToAnotherRecord. ' +
    'For SingleSelect and MultiSelect, pass choices as an array: [{ "title": "Option A" }, { "title": "Option B" }]. ' +
    'For LinkToAnotherRecord, pass relation_type ("om", "mo", "mm", or "oo") and related_table_name. ' +
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
          'Examples: "SingleLineText", "Number", "Date", "SingleSelect", "Checkbox", "LinkToAnotherRecord".',
      ),
    choices: z
      .array(z.object({ title: z.string() }))
      .optional()
      .describe(
        'Required for SingleSelect and MultiSelect fields. ' +
          'Array of choice objects. Example: [{ "title": "Active" }, { "title": "Inactive" }, { "title": "Pending" }]',
      ),
    relation_type: z
      .enum(['om', 'mo', 'mm', 'oo'])
      .optional()
      .describe(
        'Required for LinkToAnotherRecord fields. Relationship type: ' +
          '"om" (one-to-many), "mo" (many-to-one), "mm" (many-to-many), or "oo" (one-to-one).',
      ),
    related_table_name: z
      .string()
      .optional()
      .describe(
        'Required for LinkToAnotherRecord fields. ' +
          'The title of the table to link to (case-insensitive). The target table must already exist.',
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
      relation_type?: 'om' | 'mo' | 'mm' | 'oo';
      related_table_name?: string;
    },
    req: NcRequest,
  ) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const columnPayload: Record<string, any> = {
      title: args.title,
      type: args.type,
    };

    if (args.choices) {
      columnPayload.choices = args.choices;
    }

    // LinkToAnotherRecord requires resolving the related table name to an ID
    if (args.type === 'LinkToAnotherRecord') {
      if (!args.relation_type || !args.related_table_name) {
        return 'ERROR: LinkToAnotherRecord fields require both "relation_type" (om, mo, mm, or oo) and "related_table_name".';
      }

      const relatedModel = await resolveTableByName(
        context,
        args.related_table_name,
      );

      columnPayload.options = {
        relation_type: args.relation_type,
        related_table_id: relatedModel.id,
      };
    }

    const column = await columnsV3Service.columnAdd(context, {
      tableId: model.id,
      column: columnPayload as any,
      req,
      user: req.user,
    });

    return column;
  },
};
