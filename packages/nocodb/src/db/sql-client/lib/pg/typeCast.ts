/*
 * Map of date formats to their respective regex patterns.
 */
const DATE_FORMATS = {
  'YYYY-MM-DD': '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
  'YYYY/MM/DD': '^[0-9]{4}/[0-9]{2}/[0-9]{2}$',
  'DD-MM-YYYY': '^[0-9]{2}-[0-9]{2}-[0-9]{4}$',
  'MM-DD-YYYY': '^[0-9]{2}-[0-9]{2}-[0-9]{4}$',
  'DD/MM/YYYY': '^[0-9]{2}/[0-9]{2}/[0-9]{4}$',
  'MM/DD/YYYY': '^[0-9]{2}/[0-9]{2}/[0-9]{4}$',
  'DD MM YYYY': '^[0-9]{2} [0-9]{2} [0-9]{4}$',
  'MM DD YYYY': '^[0-9]{2} [0-9]{2} [0-9]{4}$',
  'YYYY MM DD': '^[0-9]{4} [0-9]{2} [0-9]{2}$',
};

/*
 * Map of date time formats to their respective regex patterns.
 */
const TIME_FORMATS = {
  'HH:mm': '^[0-9]{2}:[0-9]{2}$',
  'HH:mm:ss': '^[0-9]{2}:[0-9]{2}:[0-9]{2}$',
  'HH:mm:ss.SSS': '^[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}$',
};

/*
 * Generate query to extract number from a string. The number is extracted by
 * removing all non-numeric characters from the string. Decimal point is allowed.
 * If there are more than one decimal points, only the first one is considered, the rest are ignored.
 *
 * @param {String} source - source column name
 * @returns {String} - query to extract number from a string
 */
import { UITypes } from 'nocodb-sdk';

function extractNumberQuery(source: string) {
  return `
    CAST(
      NULLIF(
        REPLACE(
          REPLACE(
            REGEXP_REPLACE(
              REGEXP_REPLACE(${source}, '[^0-9.]', '', 'g'), 
              '(\\d)\\.', '\\1-'
            ), 
            '.', ''
          ), 
          '-', '.'
        ), ''
      ) AS DECIMAL
    )
  `;
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
      WHEN ${columnName} IN ('checked', 'x', 'yes', 'y', '1', '[x]', '☑', '✅', '✓', '✔', 'enabled', 'on', 'done', 'true') THEN true
      WHEN ${columnName} IN ('unchecked', '', 'no', 'n', '0', '[]', '[ ]', 'disabled', 'off', 'false') THEN false
      ELSE null
    END;
  `;
}

/*
 * Generate query to cast a value to single select. The single select value is
 * determined based on the given options.
 *
 * @param {String} columnName - Source column name
 * @param {String[]} options - Single select options
 * @returns {String} - query to cast value to single select
 */
function generateSingleSelectCastQuery(
  columnName: string,
  options: string[],
): string {
  return `CASE 
    WHEN ${columnName} IN (${options
    .map((option) => `'${option}'`)
    .join(',')}) THEN ${columnName}
    ELSE NULL
    END;`;
}

/*
 * Generate query to cast a value to date based on the given format.
 *
 * @param {String} source - Source column name
 * @param {String} format - Date format
 * @returns {String} - query to cast value to date
 */
function generateDateCastQuery(source: string, format: string) {
  if (!(format in DATE_FORMATS)) {
    throw new Error(`Invalid date format: ${format}`);
  }

  return `CASE 
    WHEN ${source} ~ '${DATE_FORMATS[format]}' THEN TO_DATE(${source}, '${format}')
    ELSE NULL
   END;`;
}

/*
 * Generate query to cast a value to date time based on the given date and time formats.
 *
 * @param {String} source - Source column name
 * @param {String} dateFormat - Date format
 * @param {String} timeFormat - Time format
 * @returns {String} - query to cast value to date time
 */
function generateDateTimeCastQuery(
  source: string,
  dateFormat: string,
  timeFormat: string,
) {
  if (!(dateFormat in DATE_FORMATS) || !(timeFormat in TIME_FORMATS)) {
    throw new Error(
      `Invalid date or time format: ${dateFormat}, ${timeFormat}`,
    );
  }

  return `CASE 
    WHEN ${source} ~ '${DATE_FORMATS[dateFormat]} ${TIME_FORMATS[timeFormat]}' 
      THEN TO_TIMESTAMP(${source}, '${dateFormat} ${timeFormat}')
    ELSE NULL
   END;`;
}

/*
 * Generate query to cast a value to time based on the given time formats.
 *
 * @param {String} source - Source column name
 * @returns {String} - query to cast value to time
 */
function generateTimeCastQuery(source: string) {
  return `CASE 
    ${Object.keys(TIME_FORMATS)
      .map(
        (format) =>
          `WHEN ${source} ~ '${TIME_FORMATS[format]}' THEN TO_TIMESTAMP(${source}, '${format}')`,
      )
      .join('\n')}
    ELSE NULL
   END;`;
}

/*
 * Generate query to cast a column to a specific data type based on the UI data type.
 *
 * @param {UITypes} uidt - UI data type
 * @param {String} source - Source column name
 * @param {Number} limit - Limit for the data type
 * @param {String} dateFormat - Date format
 * @param {String} timeFormat - Time format
 * @returns {String} - query to cast column to a specific data type
 */
export function generateCastQuery(
  uidt: UITypes,
  source: string,
  limit: number,
  dateFormat = 'YYYY-MM-DD',
  timeFormat = 'HH:mm:ss',
) {
  switch (uidt) {
    case UITypes.LongText:
      return `${source}::TEXT;`;
    case UITypes.SingleLineText:
    case UITypes.Email:
    case UITypes.URL:
      return `${source}::VARCHAR(${limit || 255});`;
    case UITypes.Number:
      return `CAST(${extractNumberQuery(source)} AS BIGINT);`;
    case UITypes.Decimal:
    case UITypes.Currency:
      return `${extractNumberQuery(source)};`;
    case UITypes.Percent:
      return `MIN(100, MAX(0, ${extractNumberQuery(source)}));`;
    case UITypes.Rating:
      return `MIN(${limit || 5}, MAX(0, ${extractNumberQuery(source)}));`;
    case UITypes.Checkbox:
      return generateBooleanCastQuery(source);
    case UITypes.Date:
      return generateDateCastQuery(source, dateFormat);
    case UITypes.DateTime:
      return generateDateTimeCastQuery(source, dateFormat, timeFormat);
    case UITypes.Time:
      return generateTimeCastQuery(source);
    case UITypes.Duration:
      return `CAST(${extractNumberQuery(source)} AS INTEGER);`;
    case UITypes.SingleSelect:
      return generateSingleSelectCastQuery(source, []);
    case UITypes.MultiSelect:
      return `${source}::ARRAY;`;
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
    case UITypes.Email:
    case UITypes.URL:
    case UITypes.SingleSelect:
      return `"${columnName}"`;
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Rating:
    case UITypes.Duration:
      return `CAST("${columnName}" AS TEXT)`;
    case UITypes.Checkbox:
      return `CAST(CASE WHEN "${columnName}" THEN '1' ELSE '0' END AS TEXT)`;
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.Time:
      return `CAST("${columnName}" AS TEXT)`;
    case UITypes.MultiSelect:
      return `ARRAY_TO_STRING("${columnName}", ',')`;
  }
}
