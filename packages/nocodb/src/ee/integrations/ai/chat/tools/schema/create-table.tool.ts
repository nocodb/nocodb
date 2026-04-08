import { z } from 'zod';
import { ProjectRoles, UITypes } from 'nocodb-sdk';
import type { TableFieldBaseCreateV3Type } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { fieldOptionsSchema } from '~/integrations/ai/chat/tools/schema/field-options.schema';
import { stripIrrelevantOptions } from '~/integrations/ai/chat/tools/helpers';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

// ── Allowed field types for create_table (basic types only) ─────────────────
// Links, Lookup, Rollup, Formula, Barcode, QrCode, Button must be added via add_field.

const CreateTableFieldTypes = [
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.JSON,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Duration,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Time,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Checkbox,
  UITypes.Attachment,
  UITypes.Year,
  UITypes.AutoNumber,
  UITypes.User,
] as const;

const createTableFieldSchema = z.object({
  title: z.string().describe('Display name of the field.'),
  type: z
    .enum(CreateTableFieldTypes)
    .describe('Field type — only basic types allowed during table creation.'),
  description: z.string().optional().describe('Optional field description.'),
  default_value: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe('Default value for the field.'),
  options: fieldOptionsSchema
    .optional()
    .describe(
      'Type-specific options (e.g. choices for SingleSelect). ' +
        'Only provide properties relevant to the chosen type.',
    ),
});

export const createTableTool = defineChatTool({
  name: ChatToolName.CREATE_TABLE,
  description:
    'Create a new table in the base with optional initial fields. ' +
    'An auto-increment ID primary key is always added automatically — do NOT include it. ' +
    'Only basic field types are supported during creation (text, number, date, select, etc.). ' +
    'Links, Lookup, Rollup, Formula, Barcode, QrCode, and Button fields must be added after via add_field. ' +
    'If fields are omitted, only the ID column is created — use add_field to add more later.',
  schema: z.object({
    title: z
      .string()
      .describe(
        'Display name of the new table. Must be unique within the base.',
      ),
    description: z
      .string()
      .optional()
      .describe('Optional description of the table.'),
    fields: z
      .array(createTableFieldSchema)
      .optional()
      .describe(
        'Optional list of fields to create with the table. Do NOT include an ID field. ' +
          'Link fields are not supported here — use add_field after table creation.',
      ),
  }),
  permission: 'tableCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);

    const fields = (args.fields || [])
      .map((f) => {
        if (!f.title) return;
        const field: Record<string, any> = {
          title: f.title,
          type: f.type as TableFieldBaseCreateV3Type['type'],
        };
        if (f.description) field.description = f.description;
        if (f.options) {
          field.options = stripIrrelevantOptions(f.type, f.options);
        }
        if (f.default_value !== undefined)
          field.default_value = f.default_value;
        return field;
      })
      .filter(Boolean);

    const table = await tablesV3Service.tableCreate(context, {
      baseId: context.base_id,
      table: {
        title: args.title,
        ...(args.description ? { description: args.description } : {}),
        fields: fields as any,
      },
      user: req.user,
      req,
    });

    return {
      id: table.id,
      title: table.title,
      message: `Table "${table.title}" created successfully.`,
    };
  },
});
