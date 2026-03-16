import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

export const modifyFieldTool = defineChatTool({
  name: ChatToolName.MODIFY_FIELD,
  description:
    'Modify an existing field — rename, change type, update options, or set description. ' +
    'At least one of title, type, options, or description must be provided. ' +
    'WARNING: Changing field type may cause data loss if existing values are incompatible. ' +
    'For SingleSelect/MultiSelect, providing options.choices REPLACES the full option list — ' +
    'include ALL desired options (existing + new), not just additions. ' +
    'Call describe_table first to see current field details.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the field (case-insensitive).',
      ),
    field_name: z
      .string()
      .describe('The current title of the field to modify (case-insensitive).'),
    title: z
      .string()
      .optional()
      .describe('New display name for the field. Omit if not renaming.'),
    type: z
      .string()
      .optional()
      .describe(
        'New field type (e.g. "LongText", "Number", "SingleSelect"). Omit if not changing type. ' +
          'WARNING: changing type may cause data loss.',
      ),
    description: z
      .string()
      .nullable()
      .optional()
      .describe(
        'New description for the field. Pass null to clear. Omit if not changing.',
      ),
    options: z
      .record(z.any())
      .optional()
      .describe(
        'Type-specific options to update. Same structure as add_field options. Key examples:\n' +
          '• SingleSelect / MultiSelect: { "choices": [{ "title": "Todo" }, { "title": "Done" }] } — REPLACES all existing choices.\n' +
          '• Currency: { "code": "EUR" }. Decimal: { "precision": 3 }. Rating: { "max_value": 10 }\n' +
          '• Formula: { "formula": "CONCAT({FirstName}, \' \', {LastName})" }\n' +
          '• LongText: { "rich_text": true }. User: { "allow_multiple_users": true }\n' +
          '• Date/DateTime: { "date_format": "YYYY-MM-DD", "time_format": "HH:mm" }\n' +
          '• Duration: { "duration_format": "h:mm:ss" }. Percent: { "show_as_progress": true }\n' +
          '• Number: { "locale_string": true }. PhoneNumber/URL/Email: { "validation": true }\n' +
          '• Checkbox: { "icon": "star" | "heart" | "circle-filled" | "thumbs-up" | "flag" }\n' +
          'NOTE: Lookup, Rollup, Barcode, QrCode options cannot be changed after creation — recreate the field instead.',
      ),
    default_value: z
      .union([z.string(), z.boolean(), z.number()])
      .optional()
      .describe('New default value for the field.'),
    unique: z
      .boolean()
      .optional()
      .describe('Enable or disable unique constraint.'),
  }),
  permission: 'columnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const updatePayload: Record<string, any> = {
      // title is required by the V3 FieldUpdate schema — default to current title
      title: args.title || column.title,
    };
    if (args.type) updatePayload.type = args.type;
    if (args.description !== undefined)
      updatePayload.description = args.description;
    if (args.options) updatePayload.options = args.options;
    if (args.default_value !== undefined)
      updatePayload.default_value = args.default_value;
    if (args.unique !== undefined) updatePayload.unique = args.unique;

    return await columnsV3Service.columnUpdate(context, {
      columnId: column.id,
      column: updatePayload as any,
      req,
      user: req.user,
    });
  },
});
