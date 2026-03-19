import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { fieldOptionsSchema } from '~/integrations/ai/chat/tools/schema/field-options.schema';
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
    'Add a new field (column) to an existing table. Returns the created field in V3 format.\n\n' +
    'The `options` object holds type-specific configuration — see its property descriptions for which field types each option applies to. ' +
    'Call describe_table first to see existing fields and avoid duplicate names.\n\n' +
    'Name resolution helpers (use names, not IDs):\n' +
    '• Links/LTAR: set related_table_name (resolved to related_table_id)\n' +
    '• Lookup: set related_field_name + lookup_field_name (resolved to IDs)\n' +
    '• Rollup: set related_field_name + rollup_field_name + rollup_function\n' +
    '• Barcode: set barcode_value_field_name (resolved to barcode_value_field_id)\n' +
    '• QrCode: set qrcode_value_field_name (resolved to qrcode_value_field_id)\n\n' +
    'No options needed for: SingleLineText, Attachment, JSON, Year, Geometry, CreatedBy, LastModifiedBy.',
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
    options: fieldOptionsSchema
      .optional()
      .describe(
        'Type-specific options. Only provide options relevant to the chosen field type.',
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
      // Cast to mutable record — we add resolved IDs and delete name keys below
      const options: Record<string, any> = { ...args.options };

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
