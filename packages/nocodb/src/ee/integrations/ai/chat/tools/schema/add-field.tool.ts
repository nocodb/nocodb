import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Model from '~/models/Model';
import Noco from '~/Noco';

const CREATABLE_FIELD_TYPES = [
  // Basic text & contact
  'SingleLineText',
  'LongText',
  'PhoneNumber',
  'URL',
  'Email',
  // Numeric
  'Number',
  'Decimal',
  'Currency',
  'Percent',
  'Duration',
  // Date & time
  'Date',
  'DateTime',
  'Time',
  'Year',
  // Selection
  'SingleSelect',
  'MultiSelect',
  'Rating',
  'Checkbox',
  // Media & data
  'Attachment',
  'JSON',
  'Geometry',
  // Users
  'User',
  // Relationships
  'Links',
  'LinkToAnotherRecord',
  // Derived / computed
  'Lookup',
  'Rollup',
  'Formula',
  // Visual
  'Barcode',
  'QrCode',
  'Button',
  // System / auto
  'CreatedTime',
  'LastModifiedTime',
  'CreatedBy',
  'LastModifiedBy',
] as const;

export const addFieldTool = defineChatTool({
  name: ChatToolName.ADD_FIELD,
  description:
    'Add a new field (column) to an existing table. Returns the created field in V3 format. ' +
    'The `options` object holds type-specific configuration (choices, link target, formula, etc.). ' +
    'Call describe_table first to see existing fields and avoid duplicate names. ' +
    'For Lookup/Rollup/Barcode/QrCode, use field_name helpers (related_field_name, etc.) — they will be resolved to IDs.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table to add the field to (case-insensitive).',
      ),
    title: z
      .string()
      .describe(
        'Display name for the new field. Must be unique within the table.',
      ),
    type: z.enum(CREATABLE_FIELD_TYPES).describe('Field data type.'),
    description: z
      .string()
      .optional()
      .describe('Optional description of the field.'),
    options: z
      .record(z.any())
      .optional()
      .describe(
        'Type-specific options object. Structure depends on the field type:\n\n' +
          '── Selection ──\n' +
          '• SingleSelect / MultiSelect: { "choices": [{ "title": "Option A" }, { "title": "Option B" }] }\n\n' +
          '── Relationships ──\n' +
          '• Links / LinkToAnotherRecord: { "relation_type": "hm" | "mm" | "oo", "related_table_name": "TableName" }\n' +
          '  → use related_table_name (case-insensitive), resolved to related_table_id automatically.\n\n' +
          '── Derived / Computed ──\n' +
          '• Lookup: { "related_field_name": "LinkFieldName", "lookup_field_name": "FieldInLinkedTable" }\n' +
          '  → Both names are resolved to IDs. related_field_name must be a Links/LTAR field in this table.\n' +
          '  → lookup_field_name is the field in the linked table whose values to pull.\n' +
          '• Rollup: { "related_field_name": "LinkFieldName", "rollup_field_name": "FieldInLinkedTable", ' +
          '"rollup_function": "count" | "min" | "max" | "avg" | "sum" | "countDistinct" | "sumDistinct" | "avgDistinct" }\n' +
          '  → related_field_name and rollup_field_name are resolved to IDs.\n' +
          '• Formula: { "formula": "CONCAT({FirstName}, \' \', {LastName})" }\n' +
          '  → Use {FieldName} to reference other fields. Supports: CONCAT, IF, AND, OR, LEN, TRIM, UPPER, LOWER, ' +
          'ROUND, CEILING, FLOOR, ABS, MOD, POWER, SQRT, LOG, NOW, TODAY, DATEADD, DATEDIFF, etc.\n\n' +
          '── Visual ──\n' +
          '• Barcode: { "barcode_value_field_name": "FieldName", "format": "CODE128" }\n' +
          '  → barcode_value_field_name is resolved to barcode_value_field_id.\n' +
          '• QrCode: { "qrcode_value_field_name": "FieldName" }\n' +
          '  → qrcode_value_field_name is resolved to qrcode_value_field_id.\n' +
          '• Button: { "type": "formula", "formula": "CONCAT(...)", "label": "Click Me", ' +
          '"color": "brand", "theme": "solid" }\n' +
          '  → type can be "formula" (requires formula) or "webhook" (requires button_hook_id).\n\n' +
          '── Numeric ──\n' +
          '• Currency: { "code": "USD", "locale": "en-US" }\n' +
          '• Decimal: { "precision": 2 } (0–8)\n' +
          '• Duration: { "duration_format": "h:mm:ss" }\n' +
          '• Number: { "locale_string": true } (show thousand separator)\n' +
          '• Percent: { "show_as_progress": true }\n' +
          '• Rating: { "max_value": 5, "icon": "star" | "heart" | "circle-filled" | "thumbs-up" | "flag" }\n\n' +
          '── Date & Time ──\n' +
          '• Date: { "date_format": "YYYY-MM-DD" }\n' +
          '• DateTime / CreatedTime / LastModifiedTime: { "date_format": "YYYY-MM-DD", "time_format": "HH:mm", "12hr_format": false }\n' +
          '• Time: { "time_format": "HH:mm:ss" }\n\n' +
          '── Text & Contact ──\n' +
          '• LongText: { "rich_text": true }\n' +
          '• PhoneNumber / URL / Email: { "validation": true }\n\n' +
          '── Users ──\n' +
          '• User: { "allow_multiple_users": true }\n\n' +
          '── Checkbox ──\n' +
          '• Checkbox: { "icon": "square" | "circle-check" | "star" | "heart" | "thumbs-up" | "flag" }\n\n' +
          '── No options needed ──\n' +
          '• SingleLineText, Attachment, JSON, Year, Geometry, CreatedBy, LastModifiedBy: no options required.',
      ),
    default_value: z
      .union([z.string(), z.boolean(), z.number()])
      .optional()
      .describe(
        'Default value for the field. Applicable for text, number, date, select, checkbox, and JSON fields.',
      ),
    unique: z
      .boolean()
      .optional()
      .describe(
        'Enable unique constraint — no duplicate values allowed. ' +
          'Supported for: SingleLineText, PhoneNumber, URL, Email, Number, Decimal, Currency, Percent, Date, DateTime, Time.',
      ),
  }),
  permission: 'columnAdd',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const columnsV3Service: ColumnsV3Service =
      Noco.nestApp.get(ColumnsV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const columnPayload: Record<string, any> = {
      title: args.title,
      type: args.type,
    };

    if (args.description) {
      columnPayload.description = args.description;
    }

    if (args.default_value !== undefined) {
      columnPayload.default_value = args.default_value;
    }

    if (args.unique !== undefined) {
      columnPayload.unique = args.unique;
    }

    if (args.options) {
      const options = { ...args.options };

      // Resolve related_table_name → related_table_id for link fields
      if (
        (args.type === 'Links' || args.type === 'LinkToAnotherRecord') &&
        options.related_table_name
      ) {
        const relatedModel = await resolveTableByName(
          context,
          options.related_table_name,
        );
        options.related_table_id = relatedModel.id;
        delete options.related_table_name;
      }

      // Resolve field names → field IDs for Lookup
      if (args.type === 'Lookup') {
        if (options.related_field_name) {
          const linkColumn = await resolveColumnByName(
            context,
            model,
            options.related_field_name,
          );
          options.related_field_id = linkColumn.id;

          // Resolve lookup_field_name in the linked table
          if (options.lookup_field_name) {
            const relatedModelId = linkColumn.colOptions?.fk_related_model_id;
            if (relatedModelId) {
              const relatedModel = await Model.get(context, relatedModelId);
              const lookupColumn = await resolveColumnByName(
                context,
                relatedModel,
                options.lookup_field_name,
              );
              options.related_table_lookup_field_id = lookupColumn.id;
            }
            delete options.lookup_field_name;
          }
          delete options.related_field_name;
        }
      }

      // Resolve field names → field IDs for Rollup
      if (args.type === 'Rollup') {
        if (options.related_field_name) {
          const linkColumn = await resolveColumnByName(
            context,
            model,
            options.related_field_name,
          );
          options.related_field_id = linkColumn.id;

          // Resolve rollup_field_name in the linked table
          if (options.rollup_field_name) {
            const relatedModelId = linkColumn.colOptions?.fk_related_model_id;
            if (relatedModelId) {
              const relatedModel = await Model.get(context, relatedModelId);
              const rollupColumn = await resolveColumnByName(
                context,
                relatedModel,
                options.rollup_field_name,
              );
              options.related_table_rollup_field_id = rollupColumn.id;
            }
            delete options.rollup_field_name;
          }
          delete options.related_field_name;
        }
      }

      // Resolve field name → field ID for Barcode
      if (args.type === 'Barcode' && options.barcode_value_field_name) {
        const valueColumn = await resolveColumnByName(
          context,
          model,
          options.barcode_value_field_name,
        );
        options.barcode_value_field_id = valueColumn.id;
        delete options.barcode_value_field_name;
      }

      // Resolve field name → field ID for QrCode
      if (args.type === 'QrCode' && options.qrcode_value_field_name) {
        const valueColumn = await resolveColumnByName(
          context,
          model,
          options.qrcode_value_field_name,
        );
        options.qrcode_value_field_id = valueColumn.id;
        delete options.qrcode_value_field_name;
      }

      columnPayload.options = options;
    }

    return await columnsV3Service.columnAdd(context, {
      tableId: model.id,
      column: columnPayload as any,
      req,
      user: req.user,
    });
  },
});
