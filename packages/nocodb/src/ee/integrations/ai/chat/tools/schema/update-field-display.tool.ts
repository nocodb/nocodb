import { z } from 'zod';
import {
  ProjectRoles,
  UITypes,
  checkboxIconList,
  ratingIconList,
} from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsService } from '~/services/columns.service';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import Noco from '~/Noco';

/**
 * Check if a value was meaningfully provided by the LLM.
 * Filters out empty strings, null, undefined — but keeps `false`, `0`, etc.
 */
function isProvided(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

// ── Allowed values for constrained format parameters ──

const VALID_DATE_FORMATS = new Set([
  'YYYY-MM-DD', 'YYYY/MM/DD', 'DD-MM-YYYY', 'MM-DD-YYYY',
  'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MM YYYY', 'MM DD YYYY',
  'YYYY MM DD', 'DD MMM YYYY', 'DD MMM YY', 'DD.MM.YYYY', 'DD.MM.YY',
]);

const VALID_TIME_FORMATS = new Set(['HH:mm', 'HH:mm:ss', 'HH:mm:ss.SSS']);

const VALID_DURATION_FORMATS = new Set([
  'h:mm', 'h:mm:ss', 'h:mm:ss.s', 'h:mm:ss.ss', 'h:mm:ss.sss',
]);

/**
 * Validate constrained format values, scoped by field type.
 * Only checks parameters that are relevant to the given uidt — irrelevant
 * parameters (e.g. max_value on a Date field) are silently ignored.
 * For format fields with a fixed set of valid options, the error instructs
 * the LLM to call ask_user so the user can pick from clickable buttons.
 */
function validateFormats(
  uidt: UITypes,
  args: Record<string, unknown>,
): string | null {
  // Date / DateTime / CreatedTime / LastModifiedTime
  const dateTypes = [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime];
  if (dateTypes.includes(uidt) && isProvided(args.date_format) && !VALID_DATE_FORMATS.has(args.date_format as string)) {
    const options = [...VALID_DATE_FORMATS].join(', ');
    return (
      `Invalid date_format "${args.date_format}". ` +
      `Call ask_user with the question "Which date format would you like?" ` +
      `and these options: ${options}`
    );
  }

  // DateTime / CreatedTime / LastModifiedTime
  const timeTypes = [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime];
  if (timeTypes.includes(uidt) && isProvided(args.time_format) && !VALID_TIME_FORMATS.has(args.time_format as string)) {
    const options = [...VALID_TIME_FORMATS].join(', ');
    return (
      `Invalid time_format "${args.time_format}". ` +
      `Call ask_user with the question "Which time format would you like?" ` +
      `and these options: ${options}`
    );
  }

  // Duration
  if (uidt === UITypes.Duration && isProvided(args.duration_format) && !VALID_DURATION_FORMATS.has(args.duration_format as string)) {
    const options = [...VALID_DURATION_FORMATS].join(', ');
    return (
      `Invalid duration_format "${args.duration_format}". ` +
      `Call ask_user with the question "Which duration format would you like?" ` +
      `and these options: ${options}`
    );
  }

  // Precision: Decimal, Currency, Percent, Rollup
  const precisionTypes = [UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Rollup];
  if (precisionTypes.includes(uidt) && isProvided(args.precision)) {
    const p = args.precision as number;
    if (!Number.isInteger(p) || p < 0 || p > 8) {
      return `Invalid precision "${p}". Must be an integer between 0 and 8.`;
    }
  }

  // Max value: Rating only
  if (uidt === UITypes.Rating && isProvided(args.max_value)) {
    const m = args.max_value as number;
    if (!Number.isInteger(m) || m < 1 || m > 10) {
      return `Invalid max_value "${m}". Must be an integer between 1 and 10.`;
    }
  }

  return null;
}

/**
 * Build the actual column.meta object from the flat tool args.
 * Returns only the keys that were meaningfully provided — omitted keys
 * are left untouched by the column-update service (merge semantics).
 */
function buildMeta(
  uidt: UITypes,
  args: Record<string, unknown>,
): Record<string, unknown> | null {
  const meta: Record<string, unknown> = {};
  let hasKey = false;

  const set = (key: string, value: unknown) => {
    if (isProvided(value)) {
      meta[key] = value;
      hasKey = true;
    }
  };

  // ---------- Date / DateTime / CreatedTime / LastModifiedTime ----------
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(uidt)
  ) {
    set('date_format', args.date_format);
  }

  if (
    [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
      uidt,
    )
  ) {
    set('time_format', args.time_format);
    set('is12hrFormat', args.is_12hr_format);
  }

  // ---------- Time ----------
  if (uidt === UITypes.Time) {
    set('is12hrFormat', args.is_12hr_format);
  }

  // ---------- Number ----------
  if (uidt === UITypes.Number) {
    set('isLocaleString', args.locale_string);
  }

  // ---------- Decimal ----------
  if (uidt === UITypes.Decimal) {
    set('precision', args.precision);
    set('isLocaleString', args.locale_string);
  }

  // ---------- Currency ----------
  if (uidt === UITypes.Currency) {
    set('currency_code', args.currency_code);
    set('currency_locale', args.currency_locale);
    set('precision', args.precision);
  }

  // ---------- Percent ----------
  if (uidt === UITypes.Percent) {
    set('precision', args.precision);
    set('is_progress', args.show_as_progress);
  }

  // ---------- Duration ----------
  if (uidt === UITypes.Duration) {
    if (isProvided(args.duration_format)) {
      meta.duration_format = args.duration_format;
      hasKey = true;
    }
  }

  // ---------- Rating ----------
  if (uidt === UITypes.Rating) {
    set('color', args.color);
    if (isProvided(args.max_value)) set('max', args.max_value);
    if (isProvided(args.icon)) {
      const idx = ratingIconList.findIndex(
        (i) => i.label === args.icon,
      );
      if (idx !== -1) {
        meta.iconIdx = idx;
        meta.icon = {
          full: ratingIconList[idx].full,
          empty: ratingIconList[idx].empty,
        };
        hasKey = true;
      }
    }
  }

  // ---------- Checkbox ----------
  if (uidt === UITypes.Checkbox) {
    set('color', args.color);
    if (isProvided(args.icon)) {
      const idx = checkboxIconList.findIndex(
        (i) => i.label === args.icon,
      );
      if (idx !== -1) {
        meta.iconIdx = idx;
        meta.icon = {
          checked: checkboxIconList[idx].checked,
          unchecked: checkboxIconList[idx].unchecked,
        };
        hasKey = true;
      }
    }
  }

  // ---------- Colour ----------
  if (uidt === UITypes.Colour) {
    set('defaultColor', args.default_color);
    set('displayFormat', args.display_format);
    set('swatchStyle', args.swatch_style);
    set('swatchSize', args.swatch_size);
  }

  // ---------- Rollup ----------
  if (uidt === UITypes.Rollup) {
    set('precision', args.precision);
    set('isLocaleString', args.locale_string);
  }

  return hasKey ? meta : null;
}

export const updateFieldDisplayTool: ChatToolDefinition = {
  name: 'update_field_display',
  description:
    'Update the display formatting of a field without changing its type or data. ' +
    'This is safe — it only changes how values are rendered in the UI.\n\n' +
    'Supported field types and their options:\n' +
    '• Date / DateTime / CreatedTime / LastModifiedTime — date_format, time_format, is_12hr_format\n' +
    '• Time — is_12hr_format\n' +
    '• Number — locale_string\n' +
    '• Decimal / Rollup — precision (0–8), locale_string\n' +
    '• Currency — currency_code (ISO 4217, e.g. "USD"), currency_locale (BCP 47, e.g. "en-US"), precision (0–8)\n' +
    '• Percent — precision (0–8), show_as_progress\n' +
    '• Duration — duration_format ("h:mm", "h:mm:ss", "h:mm:ss.s", "h:mm:ss.ss", "h:mm:ss.sss")\n' +
    '• Rating — icon (star/heart/circle-filled/thumbs-up/flag), color (hex), max_value (1–10)\n' +
    '• Checkbox — icon (square/circle-check/star/heart/circle-filled/thumbs-up/flag), color (hex)\n' +
    '• Colour — default_color (hex), display_format (swatch_hex/swatch_only/hex_only), swatch_style (circle/square), swatch_size (small/medium/large)\n' +
    '• SingleSelect / MultiSelect — option_colors to set colors per option\n\n' +
    'IMPORTANT: Only provide the parameters relevant to the field type — do NOT send empty strings, zeros, or defaults for unrelated options.',
  parameters: {
    table_name: z
      .string()
      .describe('Title of the table (case-insensitive).'),
    field_name: z
      .string()
      .describe('Title of the field to update (case-insensitive).'),

    // Date / DateTime
    date_format: z
      .string()
      .optional()
      .describe(
        'Date display format. One of: "YYYY-MM-DD", "YYYY/MM/DD", "DD-MM-YYYY", "MM-DD-YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "DD.MM.YYYY", "DD MMM YYYY".',
      ),
    time_format: z
      .string()
      .optional()
      .describe(
        'Time display format. One of: "HH:mm", "HH:mm:ss", "HH:mm:ss.SSS".',
      ),
    is_12hr_format: z
      .boolean()
      .optional()
      .describe('Use 12-hour format with AM/PM instead of 24-hour.'),

    // Numeric
    precision: z
      .number()
      .optional()
      .describe('Decimal places to display (0–8). For Decimal, Currency, Percent, Rollup.'),
    locale_string: z
      .boolean()
      .optional()
      .describe('Enable locale-based number formatting (e.g. 1,000.00). For Number, Decimal, Rollup.'),

    // Currency
    currency_code: z
      .string()
      .optional()
      .describe('ISO 4217 currency code, e.g. "USD", "EUR", "INR", "GBP", "JPY".'),
    currency_locale: z
      .string()
      .optional()
      .describe('BCP 47 locale for formatting, e.g. "en-US", "en-IN", "de-DE", "ja-JP".'),

    // Percent
    show_as_progress: z
      .boolean()
      .optional()
      .describe('Render percent as a progress bar instead of text.'),

    // Duration
    duration_format: z
      .string()
      .optional()
      .describe(
        'Duration display format. One of: "h:mm", "h:mm:ss", "h:mm:ss.s", "h:mm:ss.ss", "h:mm:ss.sss".',
      ),

    // Rating / Checkbox icon & color
    icon: z
      .string()
      .optional()
      .describe(
        'Icon style. For Rating: star, heart, circle-filled, thumbs-up, flag. ' +
          'For Checkbox: square, circle-check, star, heart, circle-filled, thumbs-up, flag.',
      ),
    color: z
      .string()
      .optional()
      .describe('Hex color for Rating or Checkbox icon, e.g. "#fcb401", "#ff0000".'),
    max_value: z
      .number()
      .optional()
      .describe('Maximum rating value (1–10). Only for Rating fields.'),

    // Colour field
    default_color: z
      .string()
      .optional()
      .describe('Default hex color for empty Colour cells, e.g. "#FFFFFF".'),
    display_format: z
      .string()
      .optional()
      .describe('Colour field display: "swatch_hex", "swatch_only", or "hex_only".'),
    swatch_style: z
      .string()
      .optional()
      .describe('Colour swatch shape: "circle" or "square".'),
    swatch_size: z
      .string()
      .optional()
      .describe('Colour swatch size: "small", "medium", or "large".'),

    // Select option colors
    option_colors: z
      .array(
        z.object({
          title: z.string(),
          color: z.string(),
        }),
      )
      .optional()
      .describe(
        'Set colors for SingleSelect/MultiSelect options. Each entry maps an option title to a hex color. ' +
          'Only options listed here will have their color changed — others keep their current color. ' +
          'Example: [{"title": "Todo", "color": "#cfdffe"}, {"title": "Done", "color": "#c2f5e8"}]',
      ),
  },
  permission: 'columnUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  readonly: false,
  async execute(
    context: NcContext,
    args: Record<string, any>,
    req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(context, model, args.field_name);

    const uidt = column.uidt as UITypes;

    // --- Handle select option colors separately (needs V3 choices path) ---
    if (args.option_colors?.length) {
      if (
        uidt !== UITypes.SingleSelect &&
        uidt !== UITypes.MultiSelect
      ) {
        return {
          error:
            'option_colors is only supported for SingleSelect and MultiSelect fields.',
        };
      }

      const columnsV3Service: ColumnsV3Service =
        Noco.nestApp.get(ColumnsV3Service);

      // #12 — Eager-load colOptions; resolveColumnByName may not populate them.
      const colOptions = await column.getColOptions(context);
      const existingOptions = colOptions?.options ?? [];
      const colorMap = new Map<string, string>(
        args.option_colors.map((o: any) => [o.title, o.color]),
      );

      const choices = existingOptions.map((opt: any) => ({
        id: opt.id,
        title: opt.title,
        color: colorMap.get(opt.title) ?? opt.color,
      }));

      await columnsV3Service.columnUpdate(context, {
        columnId: column.id,
        column: { choices } as any,
        req,
        user: req.user,
      });

      return {
        message: `Updated colors for ${colorMap.size} option(s) in "${column.title}".`,
      };
    }

    // --- Validate constrained format values before applying ---
    const validationError = validateFormats(uidt, args);
    if (validationError) {
      return { error: validationError };
    }

    // --- Handle meta updates (use CE service directly — meta is a first-class field) ---
    const meta = buildMeta(uidt, args);

    if (!meta) {
      return {
        error:
          'No valid display options provided for this field type. ' +
          'Use describe_table to check the field type, then provide matching options.',
      };
    }

    const columnsService: ColumnsService = Noco.nestApp.get(ColumnsService);

    await columnsService.columnUpdate(context, {
      columnId: column.id,
      column: { meta } as any,
      req,
      user: req.user,
    });

    return {
      message: `Updated display formatting for "${column.title}" (${uidt}).`,
      applied: meta,
    };
  },
};
