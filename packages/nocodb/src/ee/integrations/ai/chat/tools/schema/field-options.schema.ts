import { z } from 'zod';

/**
 * Typed zod schemas for V3 field options, derived from swagger-v3.json
 * FieldOptions_* definitions. Used by add_field and modify_field chat tools.
 *
 * All properties are optional — only ones relevant to the field type should be
 * provided.  The V3 service validates type-specific requirements at runtime.
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

export const RelationTypeValues = ['hm', 'mm', 'oo'] as const;

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

// ── Combined field options schema ─────────────────────────────────────────────

export const fieldOptionsSchema = z
  .object({
    // ── Selection ──────────────────────────────────────────────────────────
    choices: z
      .array(choiceSchema)
      .optional()
      .describe(
        'SingleSelect / MultiSelect: list of choices. ' +
          'For modify_field this REPLACES all existing choices — include ALL desired choices (existing + new), not just additions.',
      ),

    // ── Relationships ──────────────────────────────────────────────────────
    relation_type: z
      .enum(RelationTypeValues)
      .optional()
      .describe(
        'Links / LinkToAnotherRecord: "hm" (has-many), "mm" (many-to-many), "oo" (one-to-one).',
      ),
    related_table_name: z
      .string()
      .optional()
      .describe(
        'Links / LinkToAnotherRecord: name of the related table (case-insensitive, resolved to related_table_id).',
      ),

    // ── Lookup ─────────────────────────────────────────────────────────────
    related_field_name: z
      .string()
      .optional()
      .describe(
        'Lookup / Rollup: link field name in this table (resolved to related_field_id). Must be a Links or LTAR field.',
      ),
    lookup_field_name: z
      .string()
      .optional()
      .describe(
        'Lookup: field name in the linked table whose values to pull (resolved to related_table_lookup_field_id).',
      ),

    // ── Rollup ─────────────────────────────────────────────────────────────
    rollup_field_name: z
      .string()
      .optional()
      .describe(
        'Rollup: field name in the linked table to aggregate (resolved to related_table_rollup_field_id).',
      ),
    rollup_function: z
      .enum(RollupFunctionValues)
      .optional()
      .describe('Rollup: aggregation function.'),

    // ── Formula ────────────────────────────────────────────────────────────
    formula: z
      .string()
      .optional()
      .describe(
        'Formula / Button(formula): expression. Use {FieldName} to reference fields. ' +
          'Supports: CONCAT, IF, AND, OR, LEN, TRIM, UPPER, LOWER, ROUND, CEILING, FLOOR, ' +
          'ABS, MOD, POWER, SQRT, LOG, NOW, TODAY, DATEADD, DATEDIFF, etc.',
      ),

    // ── Visual: Barcode / QrCode ───────────────────────────────────────────
    barcode_value_field_name: z
      .string()
      .optional()
      .describe(
        'Barcode: source field name (resolved to barcode_value_field_id).',
      ),
    format: z
      .string()
      .optional()
      .describe('Barcode: barcode format (e.g. "CODE128").'),
    qrcode_value_field_name: z
      .string()
      .optional()
      .describe(
        'QrCode: source field name (resolved to qrcode_value_field_id).',
      ),

    // ── Button ─────────────────────────────────────────────────────────────
    type: z
      .enum(ButtonTypeValues)
      .optional()
      .describe('Button: sub-type ("formula", "webhook", "ai", "script").'),
    button_hook_id: z
      .string()
      .optional()
      .describe('Button(webhook): webhook ID to trigger.'),
    prompt: z.string().optional().describe('Button(ai): AI prompt to execute.'),
    integration_id: z
      .string()
      .optional()
      .describe('Button(ai): AI integration ID.'),
    output_column_ids: z
      .string()
      .optional()
      .describe('Button(ai): output column IDs.'),
    script_id: z
      .string()
      .optional()
      .describe('Button(script): script ID to run.'),
    label: z.string().optional().describe('Button: display label.'),
    theme: z
      .enum(ButtonThemeValues)
      .optional()
      .describe('Button: visual theme.'),

    // ── Date & Time ────────────────────────────────────────────────────────
    date_format: z
      .enum(DateFormatValues)
      .optional()
      .describe(
        'Date / DateTime / CreatedTime / LastModifiedTime: date display format.',
      ),
    time_format: z
      .enum(TimeFormatValues)
      .optional()
      .describe(
        'DateTime / CreatedTime / LastModifiedTime: time display format.',
      ),
    '12hr_format': z
      .boolean()
      .optional()
      .describe(
        'DateTime / Time / CreatedTime / LastModifiedTime: use 12-hour format with AM/PM.',
      ),
    display_timezone: z
      .boolean()
      .optional()
      .describe(
        'DateTime / CreatedTime / LastModifiedTime: show timezone in display.',
      ),
    timezone: z
      .string()
      .optional()
      .describe(
        'DateTime / CreatedTime / LastModifiedTime: TZ database name (e.g. "America/New_York").',
      ),
    use_same_timezone_for_all: z
      .boolean()
      .optional()
      .describe(
        'DateTime / CreatedTime / LastModifiedTime: apply same timezone to all records.',
      ),

    // ── Numeric ────────────────────────────────────────────────────────────
    precision: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .describe('Decimal: decimal places (0–5).'),
    locale_string: z
      .boolean()
      .optional()
      .describe('Number: show thousand separator (e.g. 1,000.00).'),
    code: z
      .string()
      .optional()
      .describe(
        'Currency: ISO 4217 currency code (e.g. "USD", "EUR", "INR", "GBP", "JPY").',
      ),
    locale: z
      .string()
      .optional()
      .describe(
        'Currency: BCP 47 locale for formatting (e.g. "en-US", "de-DE", "ja-JP").',
      ),
    show_as_progress: z
      .boolean()
      .optional()
      .describe('Percent: render as a progress bar instead of text.'),
    duration_format: z
      .enum(DurationFormatValues)
      .optional()
      .describe('Duration: display format.'),

    // ── Rating ─────────────────────────────────────────────────────────────
    icon: z
      .string()
      .optional()
      .describe(
        'Rating: star / heart / circle-filled / thumbs-up / flag. ' +
          'Checkbox: square / circle-check / circle-filled / star / heart / thumbs-up / flag. ' +
          'Button: icon name.',
      ),
    color: z
      .string()
      .optional()
      .describe(
        'Rating / Checkbox: hex color for the icon (e.g. "#fcb401"). ' +
          'Button: color name (brand, red, green, etc.).',
      ),
    max_value: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe('Rating: maximum rating value (1–10).'),

    // ── Text & Contact ─────────────────────────────────────────────────────
    rich_text: z
      .boolean()
      .optional()
      .describe('LongText: enable rich text formatting.'),
    generate_text_using_ai: z
      .boolean()
      .optional()
      .describe('LongText: enable AI text generation.'),
    validation: z
      .boolean()
      .optional()
      .describe('PhoneNumber / URL / Email: enable validation.'),

    // ── User ───────────────────────────────────────────────────────────────
    allow_multiple_users: z
      .boolean()
      .optional()
      .describe('User: allow selecting multiple users.'),
  })
  .describe(
    'Type-specific options. Only provide the properties relevant to the field type being created or updated.',
  );
