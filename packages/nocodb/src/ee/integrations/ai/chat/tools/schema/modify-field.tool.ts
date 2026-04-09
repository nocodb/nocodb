import { z } from 'zod';
import { ProjectRoles, UITypes } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
  stripIrrelevantOptions,
} from '~/integrations/ai/chat/tools/helpers';
import { fieldOptionsSchema } from '~/integrations/ai/chat/tools/schema/field-options.schema';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Model from '~/models/Model';
import Noco from '~/Noco';

// ── All field types that can be a modify target ─────────────────────────────

const ModifyFieldTypes = [
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
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.Year,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Checkbox,
  UITypes.Attachment,
  UITypes.AutoNumber,
  UITypes.User,
  UITypes.Links,
  UITypes.LinkToAnotherRecord,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
  UITypes.Barcode,
  UITypes.QrCode,
  UITypes.Button,
] as const;

export const modifyFieldTool = defineChatTool({
  name: ChatToolName.MODIFY_FIELD,
  description:
    'Modify an existing field — rename, change type or change display formatting. ' +
    'At least one of title, type, options, or description must be provided.\n\n' +
    'WARNING: Changing field type may cause data loss if existing values are incompatible.\n\n' +
    'Display formatting (date_format, time_format, precision, icon, color, etc.) is set via `options` — ' +
    'same as add_field. See `options` property descriptions for what applies to each field type.\n\n' +
    'For SingleSelect/MultiSelect, providing options.choices REPLACES the full option list — ' +
    'include ALL desired options (existing + new), not just additions. ' +
    'Call describe_table first to see current field details.\n\n' +
    'When changing type, provide `type` so options are validated against the new type. ' +
    'When only updating options/name without changing type, omit `type`.',
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
      .enum(ModifyFieldTypes)
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
    options: fieldOptionsSchema
      .optional()
      .describe(
        'Type-specific options to update — includes both structural options (choices, formula) ' +
          'and display formatting (date_format, precision, icon, color, etc.). ' +
          'Only provide properties relevant to the field type. Irrelevant keys are stripped at runtime.',
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

    const effectiveType = args.type || column.uidt;

    const updatePayload: Record<string, any> = {
      // title is required by the V3 FieldUpdate schema — default to current title
      title: args.title || column.title,
    };
    if (args.type) updatePayload.type = args.type;
    if (args.description !== undefined)
      updatePayload.description = args.description;
    if (args.default_value !== undefined)
      updatePayload.default_value = args.default_value;
    if (args.unique !== undefined) updatePayload.unique = args.unique;

    if (args.options) {
      // Cast to mutable record — we add resolved IDs and delete name keys below
      const options: Record<string, any> = { ...args.options };

      // Resolve related_table_name → related_table_id for link fields
      if (
        (effectiveType === 'Links' ||
          effectiveType === 'LinkToAnotherRecord') &&
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
      if (effectiveType === 'Lookup' && options.related_field_name) {
        const linkColumn = await resolveColumnByName(
          context,
          model,
          options.related_field_name,
        );
        options.related_field_id = linkColumn.id;

        if (options.lookup_field_name) {
          const colOpts =
            linkColumn.colOptions ||
            (await linkColumn.getColOptions<LinkToAnotherRecordColumn>(
              context,
            ));
          const relatedModelId = colOpts?.fk_related_model_id;
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

      // Resolve field names → field IDs for Rollup
      if (effectiveType === 'Rollup' && options.related_field_name) {
        const linkColumn = await resolveColumnByName(
          context,
          model,
          options.related_field_name,
        );
        options.related_field_id = linkColumn.id;

        if (options.rollup_field_name) {
          const colOpts =
            linkColumn.colOptions ||
            (await linkColumn.getColOptions<LinkToAnotherRecordColumn>(
              context,
            ));
          const relatedModelId = colOpts?.fk_related_model_id;
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

      // Resolve field name → field ID for Barcode
      if (effectiveType === 'Barcode' && options.barcode_value_field_name) {
        const valueColumn = await resolveColumnByName(
          context,
          model,
          options.barcode_value_field_name,
        );
        options.barcode_value_field_id = valueColumn.id;
        delete options.barcode_value_field_name;
      }

      // Resolve field name → field ID for QrCode
      if (effectiveType === 'QrCode' && options.qrcode_value_field_name) {
        const valueColumn = await resolveColumnByName(
          context,
          model,
          options.qrcode_value_field_name,
        );
        options.qrcode_value_field_id = valueColumn.id;
        delete options.qrcode_value_field_name;
      }

      // Strip options that don't belong to this field type
      updatePayload.options = stripIrrelevantOptions(effectiveType, options);
    }

    return await columnsV3Service.columnUpdate(context, {
      columnId: column.id,
      column: updatePayload as any,
      req,
      user: req.user,
    });
  },
});
