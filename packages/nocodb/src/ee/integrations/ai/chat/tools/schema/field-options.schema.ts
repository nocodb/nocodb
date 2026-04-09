import { z } from 'zod';

/**
 * Typed zod schemas for V3 field options, derived from swagger-v3.json
 * FieldOptions_* definitions.
 *
 * Per-type schemas are exported for discriminated-union tools (add_field, create_table).
 * The combined fieldOptionsSchema is kept for modify_field (where type is optional).
 */

// ── Constrained enums (from swagger-v3.json) ─────────────────────────────────

export const DateFormatValues = [
  'YYYY/MM/DD',
  'YYYY-MM-DD',
  'YYYY MM DD',
  'DD/MM/YYYY',
  'DD-MM-YYYY',
  'DD MM YYYY',
  'MM/DD/YYYY',
  'MM-DD-YYYY',
  'MM DD YYYY',
  'YYYY-MM',
  'YYYY MM',
] as const;

export const TimeFormatValues = ['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS'] as const;

export const DurationFormatValues = [
  'h:mm',
  'h:mm:ss',
  'h:mm:ss.S',
  'h:mm:ss.SS',
  'h:mm:ss.SSS',
] as const;

export const RollupFunctionValues = [
  'count',
  'min',
  'max',
  'avg',
  'sum',
  'countDistinct',
  'sumDistinct',
  'avgDistinct',
] as const;

export const RelationTypeValues = ['oo', 'om', 'mo', 'mm'] as const;

export const RatingIconValues = [
  'star',
  'heart',
  'circle-filled',
  'thumbs-up',
  'flag',
] as const;

export const CheckboxIconValues = [
  'square',
  'circle-check',
  'circle-filled',
  'star',
  'heart',
  'thumbs-up',
  'flag',
] as const;

export const ButtonColorValues = [
  'brand',
  'red',
  'green',
  'maroon',
  'blue',
  'orange',
  'pink',
  'purple',
  'yellow',
  'gray',
] as const;

export const ButtonThemeValues = ['solid', 'light', 'text'] as const;

export const ButtonTypeValues = ['formula', 'webhook', 'ai', 'script'] as const;

// ── Choice item (SingleSelect / MultiSelect) ─────────────────────────────────

const choiceSchema = z.object({
  id: z
    .string()
    .optional()
    .describe('Choice ID — omit for new choices, include to update existing.'),
  title: z.string().describe('Choice label.'),
  color: z
    .string()
    .optional()
    .describe('Hex color (e.g. "#36BFFF"). Omit to auto-assign.'),
});

// ── Per-type option schemas ─────────────────────────────────────────────────

export const selectOptionsSchema = z.object({
  choices: z
    .array(choiceSchema)
    .describe('List of choices with optional colors.'),
});

export const validationOptionsSchema = z.object({
  validation: z.boolean().optional().describe('Enable validation.'),
});

export const longTextOptionsSchema = z.object({
  rich_text: z.boolean().optional().describe('Enable rich text formatting.'),
  generate_text_using_ai: z
    .boolean()
    .optional()
    .describe('Enable AI text generation.'),
});

export const numberOptionsSchema = z.object({
  locale_string: z
    .boolean()
    .optional()
    .describe('Show thousand separator (e.g. 1,000.00).'),
});

export const decimalOptionsSchema = z.object({
  precision: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe('Decimal places (0–5).'),
});

export const currencyOptionsSchema = z.object({
  code: z
    .string()
    .optional()
    .describe('ISO 4217 currency code (e.g. "USD", "EUR").'),
  locale: z
    .string()
    .optional()
    .describe('BCP 47 locale for formatting (e.g. "en-US").'),
});

export const percentOptionsSchema = z.object({
  show_as_progress: z
    .boolean()
    .optional()
    .describe('Render as a progress bar instead of text.'),
});

export const durationOptionsSchema = z.object({
  duration_format: z.enum(DurationFormatValues).optional(),
});

export const dateOptionsSchema = z.object({
  date_format: z.enum(DateFormatValues).optional(),
});

export const dateTimeOptionsSchema = z.object({
  date_format: z.enum(DateFormatValues).optional(),
  time_format: z.enum(TimeFormatValues).optional(),
  '12hr_format': z.boolean().optional().describe('Use 12-hour format.'),
  display_timezone: z.boolean().optional().describe('Show timezone in display.'),
  timezone: z
    .string()
    .optional()
    .describe('TZ database name (e.g. "America/New_York").'),
  use_same_timezone_for_all: z
    .boolean()
    .optional()
    .describe('Apply same timezone to all records.'),
});

export const timeOptionsSchema = z.object({
  '12hr_format': z.boolean().optional().describe('Use 12-hour format.'),
});

export const ratingOptionsSchema = z.object({
  icon: z.enum(RatingIconValues).optional(),
  color: z.string().optional().describe('Hex color (e.g. "#fcb401").'),
  max_value: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe('Maximum rating value (1–10).'),
});

export const checkboxOptionsSchema = z.object({
  icon: z.enum(CheckboxIconValues).optional(),
  color: z.string().optional().describe('Hex color (e.g. "#fcb401").'),
});

export const userOptionsSchema = z.object({
  allow_multiple_users: z
    .boolean()
    .optional()
    .describe('Allow selecting multiple users.'),
});

export const linkOptionsSchema = z.object({
  relation_type: z
    .enum(RelationTypeValues)
    .describe(
      '"om" (one-to-many — add on parent table), "mo" (many-to-one — add on child table), ' +
        '"mm" (many-to-many), "oo" (one-to-one).',
    ),
  related_table_name: z
    .string()
    .describe(
      'Name of the related table (case-insensitive, resolved to related_table_id).',
    ),
});

export const lookupOptionsSchema = z.object({
  related_field_name: z
    .string()
    .describe(
      'Link field name in this table (resolved to related_field_id). Must be a Links or LTAR field.',
    ),
  lookup_field_name: z
    .string()
    .describe(
      'Field name in the linked table whose values to pull (resolved to related_table_lookup_field_id).',
    ),
});

export const rollupOptionsSchema = z.object({
  related_field_name: z
    .string()
    .describe('Link field name in this table (resolved to related_field_id).'),
  rollup_field_name: z
    .string()
    .describe(
      'Field name in the linked table to aggregate (resolved to related_table_rollup_field_id).',
    ),
  rollup_function: z.enum(RollupFunctionValues).describe('Aggregation function.'),
});

export const formulaOptionsSchema = z.object({
  formula: z
    .string()
    .describe(
      'Formula expression. Use {FieldName} to reference fields. ' +
        'Supports: CONCAT, IF, AND, OR, LEN, TRIM, UPPER, LOWER, ROUND, etc.',
    ),
});

export const barcodeOptionsSchema = z.object({
  barcode_value_field_name: z
    .string()
    .describe('Source field name (resolved to barcode_value_field_id).'),
  format: z.string().optional().describe('Barcode format (e.g. "CODE128").'),
});

export const qrCodeOptionsSchema = z.object({
  qrcode_value_field_name: z
    .string()
    .describe('Source field name (resolved to qrcode_value_field_id).'),
});

export const buttonOptionsSchema = z.object({
  type: z
    .enum(ButtonTypeValues)
    .optional()
    .describe('Button sub-type ("formula", "webhook", "ai", "script").'),
  formula: z.string().optional().describe('Button(formula): expression.'),
  label: z.string().optional().describe('Button display label.'),
  theme: z.enum(ButtonThemeValues).optional().describe('Visual theme.'),
  color: z.string().optional().describe('Color name (brand, red, green, etc.).'),
  icon: z.string().optional().describe('Icon name.'),
  button_hook_id: z
    .string()
    .optional()
    .describe('Button(webhook): webhook ID.'),
  prompt: z.string().optional().describe('Button(ai): AI prompt.'),
  integration_id: z
    .string()
    .optional()
    .describe('Button(ai): AI integration ID.'),
  output_column_ids: z
    .string()
    .optional()
    .describe('Button(ai): output column IDs.'),
  script_id: z.string().optional().describe('Button(script): script ID.'),
});

// ── Combined field options schema (used by modify_field where type is optional) ──

export const fieldOptionsSchema = z
  .object({
    // Selection
    choices: selectOptionsSchema.shape.choices.optional(),
    // Relationships
    relation_type: linkOptionsSchema.shape.relation_type.optional(),
    related_table_name: linkOptionsSchema.shape.related_table_name.optional(),
    // Lookup
    related_field_name: lookupOptionsSchema.shape.related_field_name.optional(),
    lookup_field_name: lookupOptionsSchema.shape.lookup_field_name.optional(),
    // Rollup
    rollup_field_name: rollupOptionsSchema.shape.rollup_field_name.optional(),
    rollup_function: rollupOptionsSchema.shape.rollup_function.optional(),
    // Formula
    formula: formulaOptionsSchema.shape.formula.optional(),
    // Barcode / QrCode
    barcode_value_field_name:
      barcodeOptionsSchema.shape.barcode_value_field_name.optional(),
    format: barcodeOptionsSchema.shape.format,
    qrcode_value_field_name:
      qrCodeOptionsSchema.shape.qrcode_value_field_name.optional(),
    // Button
    type: buttonOptionsSchema.shape.type,
    button_hook_id: buttonOptionsSchema.shape.button_hook_id,
    prompt: buttonOptionsSchema.shape.prompt,
    integration_id: buttonOptionsSchema.shape.integration_id,
    output_column_ids: buttonOptionsSchema.shape.output_column_ids,
    script_id: buttonOptionsSchema.shape.script_id,
    label: buttonOptionsSchema.shape.label,
    theme: buttonOptionsSchema.shape.theme,
    // Date & Time
    date_format: dateTimeOptionsSchema.shape.date_format,
    time_format: dateTimeOptionsSchema.shape.time_format,
    '12hr_format': dateTimeOptionsSchema.shape['12hr_format'],
    display_timezone: dateTimeOptionsSchema.shape.display_timezone,
    timezone: dateTimeOptionsSchema.shape.timezone,
    use_same_timezone_for_all:
      dateTimeOptionsSchema.shape.use_same_timezone_for_all,
    // Numeric
    precision: decimalOptionsSchema.shape.precision,
    locale_string: numberOptionsSchema.shape.locale_string,
    code: currencyOptionsSchema.shape.code,
    locale: currencyOptionsSchema.shape.locale,
    show_as_progress: percentOptionsSchema.shape.show_as_progress,
    duration_format: durationOptionsSchema.shape.duration_format,
    // Rating / Checkbox
    icon: z
      .string()
      .optional()
      .describe('Rating / Checkbox / Button: icon name.'),
    color: z
      .string()
      .optional()
      .describe('Rating / Checkbox: hex color. Button: color name.'),
    max_value: ratingOptionsSchema.shape.max_value,
    // Text
    rich_text: longTextOptionsSchema.shape.rich_text,
    generate_text_using_ai: longTextOptionsSchema.shape.generate_text_using_ai,
    validation: validationOptionsSchema.shape.validation,
    // User
    allow_multiple_users: userOptionsSchema.shape.allow_multiple_users,
  })
  .describe(
    'Type-specific options. Only provide the properties relevant to the field type being updated.',
  );
