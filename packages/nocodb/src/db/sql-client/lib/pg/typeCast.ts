import {
  getCurrencyDecimalSymbol,
  getCurrencyGroupSymbol,
  getSeparatorChars,
  parseProp,
  resolveColumnSeparator,
  UITypes,
} from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
import { pgQuoteLiteral } from '~/helpers/sqlSanitize';
import { DATE_FORMATS, TIME_FORMATS } from '~/db/sql-client/lib/pg/constants';
import {
  NEGATIVE_REGEX,
  NUMERIC_LITERAL_DIGITS,
  NUMERIC_LITERAL_REGEX,
  sqlRegex,
} from '~/db/sql-client/lib/pg/numericShape';

/*
 * Read a numeric literal from text; anything else (dates, words, JSON) is NULL.
 *
 * @param {String} source - source column name
 * @returns {String} - query to extract number from a string
 */
export function extractNumberQuery(source: string) {
  // A symbol ending in `.` (`Rs.500`) is not a decimal point.
  const digits = `REGEXP_REPLACE(SUBSTRING(REGEXP_REPLACE(${source}, '^[^0-9]*[A-Za-z]\\.', '') FROM '${sqlRegex(
    NUMERIC_LITERAL_DIGITS,
  )}'), '[^0-9.eE+-]', '', 'g')`;
  return `(CASE WHEN ${source} ~ '${sqlRegex(NUMERIC_LITERAL_REGEX)}'
    THEN CAST((CASE WHEN ${source} ~ '${NEGATIVE_REGEX}' THEN '-' ELSE '' END) || ${digits} AS DECIMAL)
  END)`;
}

// Keep a value only when it fits the target column; otherwise NULL.
function boundedQuery(value: string, min: string, max: string) {
  return `(CASE WHEN ${value} BETWEEN ${min} AND ${max} THEN ${value} END)`;
}

/*
 * Generate query to cast a value to boolean. The boolean value is determined based on the given mappings.
 *
 * @param {String} columnName - Source column name
 * @returns {String} - query to cast value to boolean
 */
function generateBooleanCastQuery(columnName: string): string {
  return `
    CASE
      WHEN LOWER(${columnName}) IN ('checked', 'x', 'yes', 'y', '1', '[x]', '☑', '✅', '✓', '✔', 'enabled', 'on', 'done', 'true') THEN true
      WHEN LOWER(${columnName}) IN ('unchecked', '', 'no', 'n', '0', '[]', '[ ]', 'disabled', 'off', 'false') THEN false
      ELSE ${extractNumberQuery(columnName)} <> 0
    END;
  `;
}

/*
 * Generate query to cast a value to date time based on the given date and time formats.
 *
 * @param {String} source - Source column name
 * @param {String} dateFormat - Date format
 * @param {String} timeFormat - Time format
 * @param {String} functionName - Function name to cast value to date time
 * @returns {String} - query to cast value to date time
 */
// Only shapes the format cases can't read (a `T` or an offset) — a plain
// `YYYY-MM-DD HH:mm` must still go through the column's own date format.
const ISO_TIME = '\\d{1,2}:\\d{2}(:\\d{2}(\\.\\d+){0,1}){0,1}';
const ISO_OFFSET = '\\s*(z|[+-]\\d{2}(:{0,1}\\d{2}){0,1})';
// The last branch is a pg `timestamp` read as text once it holds milliseconds.
const ISO_DATETIME_REGEX = `^\\d{4}-\\d{1,2}-\\d{1,2}(t${ISO_TIME}(${ISO_OFFSET}){0,1}|\\s+${ISO_TIME}${ISO_OFFSET}|\\s+\\d{1,2}:\\d{2}:\\d{2}\\.\\d+)$`;

function generateDateTimeCastQuery(
  source: string,
  dateFormat: string,
  // Date targets have no zone: keep the date as written rather than shifting it by the offset.
  keepWallTime = false,
) {
  if (!(dateFormat in DATE_FORMATS)) {
    NcError.badRequest(`Invalid date format: ${dateFormat}`);
  }

  const timeFormats =
    dateFormat === 'empty' ? TIME_FORMATS : [...TIME_FORMATS, ['', '^$']];

  const cases = DATE_FORMATS[dateFormat].map(([format, regex]) =>
    timeFormats
      .map(([timeFormat, timeRegex]) => {
        // For empty time format (date only), don't add space in format string
        const formatString = timeFormat ? `${format} ${timeFormat}` : format;

        // Combine regex patterns: remove $ from date regex and ^ from time regex
        const combinedRegex = timeFormat
          ? `${regex.slice(0, -1)}\\s+${timeRegex.slice(1)}`
          : regex;

        return `WHEN ${source} ~ '${combinedRegex}' THEN to_date_time_safe(${source}, '${formatString}')`;
      })
      .join('\n'),
  );

  // ISO-8601 / our own CSV export (`2026-10-02 10:30:00+00:00`, `…T…Z`) —
  // checked first: the format cases below never match an offset or a `T`.
  const isoCase =
    dateFormat === 'empty'
      ? ''
      : `WHEN ${source} ~* '${ISO_DATETIME_REGEX}' THEN nc_iso_to_timestamp_safe(${source}, ${keepWallTime})\n`;

  return `CASE
    ${isoCase}${cases.join('\n')}
    ELSE NULL
   END;`;
}

/*
 * Generate SQL query to extract a number from a string and make out-of-bounds values NULL.
 *
 * @param {String} source - Source column name.
 * @param {Number} minValue - Minimum allowed value.
 * @param {Number} maxValue - Maximum allowed value.
 * @returns {String} - SQL query to extract number and handle out-of-bounds values.
 */
function generateNumberBoundingQuery(
  source: string,
  minValue: number,
  maxValue: number,
) {
  return `
  NULLIF(
    NULLIF(
      LEAST(
        ${maxValue + 1}, GREATEST(${minValue - 1}, ${source})
      ), ${minValue - 1}
    ), ${maxValue + 1}
  );
`;
}

/*
 * Generate query to cast a value to time: the time of day of a date-time, or
 * a time on its own.
 *
 * @param {String} source - Source column name
 */
// A date before the time of day, as a date-time renders as text.
const DATE_PREFIX = '[0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4}';

function generateTimeCastQuery(source: string) {
  // A time needs `:` (or AM/PM): a bare `5` or `12-01-15` is not one.
  const cases = TIME_FORMATS.filter(([format]) => format !== 'HH24').map(
    ([format, regex]) => {
      const time = regex.slice(1, -1).split('[:\\- /]+').join(':');
      return `WHEN ${source} ~ '^(${DATE_PREFIX}\\s+){0,1}${time}$' THEN to_date_time_safe(substring(${source} from '(${time})$'), '${format}')`;
    },
  );

  return `CASE
    WHEN ${source} ~* '${ISO_DATETIME_REGEX}' THEN nc_iso_to_timestamp_safe(${source}, true)
    ${cases.join('\n    ')}
    ELSE NULL
   END;`;
}

// An IANA zone name; anything else never reaches the SQL literal.
function isKnownTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/*
 * The time of day of a DateTime in the field's zone (UTC when it has none).
 * A pg `timestamp` DateTime holds UTC.
 */
function generateDateTimeToTimeQuery(
  rawSource: string,
  sourceDt: string | undefined,
  sourceMeta: unknown,
) {
  const timezone = parseProp(sourceMeta)?.timezone;
  const tz = isKnownTimezone(timezone) ? timezone : 'UTC';
  const instant = /with time zone|timestamptz/i.test(sourceDt ?? '')
    ? rawSource
    : `(${rawSource} AT TIME ZONE 'UTC')`;
  return `CAST((${instant} AT TIME ZONE ${pgQuoteLiteral(tz)}) AS TIME);`;
}

// Seconds per bare number: minutes for h:mm, seconds for the other formats.
export function durationBareNumberUnit(durationType: number) {
  return durationType === 0 ? 60 : 1;
}

/*
 * Generate query to cast a value to duration (stored as seconds).
 *
 * `h:m:s` is always h*3600 + m*60 + s; a 2-part value is `h:m` for h:mm (0)
 * and `m:s` for the rest. A bare number uses `durationBareNumberUnit`.
 *
 * @param {String} source - Source column name
 * @param {Number} durationType - Column meta.duration format id
 */
function generateToDurationQuery(source: string, durationType: number) {
  const part = (n: number) =>
    `CAST(SPLIT_PART(${source}, ':', ${n}) AS DECIMAL)`;

  const twoPart =
    durationType === 0
      ? `3600 * ${part(1)} + 60 * ${part(2)}`
      : `60 * ${part(1)} + ${part(2)}`;

  const unit = durationBareNumberUnit(durationType);
  const seconds = extractNumberQuery(source);

  return `
    CASE
      WHEN ${source} ~ '^\\d+:\\d{1,2}:\\d{1,2}$' THEN
        3600 * ${part(1)} + 60 * ${part(2)} + ${part(3)}
      WHEN ${source} ~ '^\\d+:\\d{1,2}$' THEN ${twoPart}
      ELSE ${unit === 1 ? seconds : `${unit} * ${seconds}`}
    END;
  `;
}

function getDateFormat(format: string) {
  const y = format.indexOf('Y');
  const m = format.indexOf('M');
  const d = format.indexOf('D');

  if (y < m) {
    if (m < d) return 'ymd';
    else if (y < d) return 'ydm';
    else return 'dym';
  } else if (y < d) return 'myd';
  else if (m < d) return 'mdy';
  else return 'dmy';
}

/**
 * The separators the column renders with. `nc_parse_locale_number` reads text by
 * its shape and only needs them to settle a lone separator that could be one
 * group. Whitelisted to '.' or ',' (group may also be '') because they land in a
 * SQL literal and meta is user-supplied.
 */
function resolveSeparators(uidt: UITypes, meta?: Record<string, any>) {
  let decimal = '.';
  let group: string | null = ',';

  if (meta && uidt === UITypes.Currency) {
    decimal = getCurrencyDecimalSymbol(
      meta.currency_code,
      meta.currency_locale,
    );
    group = getCurrencyGroupSymbol(meta.currency_code, meta.currency_locale);
  } else if (meta && uidt === UITypes.Decimal) {
    const chars = getSeparatorChars(resolveColumnSeparator(meta));
    decimal = chars.decimalSeparator;
    group = chars.thousandSeparator;
  }

  return {
    decimal: decimal === ',' ? ',' : '.',
    group: group === '.' || group === ',' ? group : '',
  };
}

// Types `formatColumn` casts from a number, so their text is `12.345`-style.
const NUMERIC_SOURCE_UIDTS = new Set<UITypes>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Duration,
  UITypes.Year,
]);

export interface GenerateCastQueryArgs {
  uidt: UITypes;
  sourceUidt?: UITypes;
  dt: string;
  source: string;
  limit: number;
  format: string;
  durationType?: number;
  meta?: Record<string, any>;
  // The unformatted source column, its dt and meta (DateTime → Time reads its zone).
  rawSource?: string;
  sourceDt?: string;
  sourceMeta?: unknown;
}

/*
 * Generate query to cast a column to a specific data type based on the UI data type.
 *
 * @param args.uidt - UI data type
 * @param args.dt - DB Data type
 * @param args.source - Source column name
 * @param args.limit - Limit for the data type
 * @param args.format - Date format
 * @param args.durationType - Duration format id (defaults to 0)
 * @param args.meta - Column meta, for the configured decimal separator
 * @param args.sourceUidt - UI data type the column is converted from
 * @param args.rawSource - Source column, unformatted
 * @param args.sourceDt - DB data type the column is converted from
 * @param args.sourceMeta - Meta of the column it is converted from
 * @returns {String} - query to cast column to a specific data type
 */
export function generateCastQuery({
  uidt,
  dt,
  source,
  limit,
  format,
  durationType = 0,
  meta,
  sourceUidt,
  rawSource,
  sourceDt,
  sourceMeta,
}: GenerateCastQueryArgs) {
  switch (uidt) {
    case UITypes.SingleLineText:
    case UITypes.MultiSelect:
    case UITypes.SingleSelect:
    case UITypes.Email:
    case UITypes.PhoneNumber:
    case UITypes.URL:
      return `${source}::VARCHAR(${limit || 255});`;
    case UITypes.LongText:
      return `${source}::TEXT;`;
    case UITypes.Number:
      return `CAST(${boundedQuery(
        `ROUND(${extractNumberQuery(source)})`,
        '-9223372036854775808',
        '9223372036854775807',
      )} AS BIGINT);`;
    case UITypes.Year:
      return generateNumberBoundingQuery(
        extractNumberQuery(source),
        1000,
        9999,
      );
    case UITypes.Decimal:
    case UITypes.Currency: {
      // A numeric source renders as Postgres's own locale-free text.
      if (sourceUidt && NUMERIC_SOURCE_UIDTS.has(sourceUidt)) {
        return `${extractNumberQuery(source)};`;
      }

      // Text is read by its shape (nocodb/nocodb#14563).
      const { decimal, group } = resolveSeparators(uidt, meta);
      return `nc_parse_locale_number(${source}, '${decimal}', '${group}');`;
    }
    case UITypes.Percent: {
      // Clamped to 0-100; tiny values would underflow a double.
      const value = extractNumberQuery(source);
      return `(CASE WHEN ${value} IS NULL THEN NULL WHEN ABS(${value}) < 1e-300 THEN 0 ELSE LEAST(100, GREATEST(0, ${value})) END);`;
    }
    case UITypes.Rating: {
      // Clamped to 0 and the column's max (sdk RatingHelper).
      const max = parseInt(meta?.max, 10) || limit || 5;
      const value = extractNumberQuery(source);
      return `(CASE WHEN ${value} IS NOT NULL THEN LEAST(${max}, GREATEST(0, ROUND(${value}))) END);`;
    }
    case UITypes.Checkbox:
      return generateBooleanCastQuery(source);
    case UITypes.Date:
      return `CAST(${generateDateTimeCastQuery(
        source,
        getDateFormat(format),
        true,
      ).slice(0, -1)} AS DATE);`;
    case UITypes.DateTime:
      return generateDateTimeCastQuery(source, getDateFormat(format));
    case UITypes.Time:
      if (sourceUidt === UITypes.DateTime && rawSource) {
        return generateDateTimeToTimeQuery(rawSource, sourceDt, sourceMeta);
      }
      return generateTimeCastQuery(source);
    case UITypes.JSON:
      return `nc_to_json_safe(${source});`;
    case UITypes.Duration:
      return generateToDurationQuery(source, durationType);
    default:
      return `null::${dt};`;
  }
}

/*
 * Generate query to format a column based on the UI data type.
 *
 * @param {String} columnName - Column name
 * @param {UITypes} uiDataType - UI data type
 * @returns {String} - query to format a column
 */
export function formatColumn(columnName: string, uiDataType: UITypes) {
  switch (uiDataType) {
    case UITypes.LongText:
    case UITypes.SingleLineText:
    case UITypes.MultiSelect:
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.SingleSelect:
    case UITypes.PhoneNumber:
      return columnName;
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.Duration:
    case UITypes.Year:
      return `CAST(${columnName} AS VARCHAR(255))`;
    case UITypes.Checkbox:
      return `CAST(CASE WHEN ${columnName} THEN '1' ELSE '0' END AS TEXT)`;
    default:
      return `CAST(${columnName} AS TEXT)`;
  }
}
