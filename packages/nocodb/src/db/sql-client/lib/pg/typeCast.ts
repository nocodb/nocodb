import { UITypes } from 'nocodb-sdk';
import { DATE_FORMATS, TIME_FORMATS } from '~/db/sql-client/lib/pg/constants';

/*
 * Generate query to extract number from a string. The number is extracted by
 * removing all non-numeric characters from the string. Decimal point is allowed.
 * If there are more than one decimal points, only the first one is considered, the rest are ignored.
 * Negatives are preserved. If statement starts with '-', number will be negated.
 *
 * @param {String} source - source column name
 * @returns {String} - query to extract number from a string
 */
function extractNumberQuery(source: string) {
  return `
    CAST(
      NULLIF(
        REPLACE(
          REPLACE(
            REPLACE(
              REGEXP_REPLACE(
                REPLACE(
                  REGEXP_REPLACE(
                    REGEXP_REPLACE(${source}, '[^0-9.-]', '', 'g'),
                    '^-', '~'
                  ),
                  '-', ''
                ),
                '(\\d)\\.(\\d)', '\\1-\\2'
              ), 
              '.', ''
            ), 
            '-', '.'
          ),
          '~', '-'
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
      WHEN LOWER(${columnName}) IN ('checked', 'x', 'yes', 'y', '1', '[x]', '☑', '✅', '✓', '✔', 'enabled', 'on', 'done', 'true') THEN true
      WHEN LOWER(${columnName}) IN ('unchecked', '', 'no', 'n', '0', '[]', '[ ]', 'disabled', 'off', 'false') THEN false
      ELSE null
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
function generateDateTimeCastQuery(source: string, dateFormat: string) {
  if (!(dateFormat in DATE_FORMATS)) {
    throw new Error(`Invalid date format: ${dateFormat}`);
  }

  const timeFormats =
    dateFormat === 'empty' ? TIME_FORMATS : [...TIME_FORMATS, ['', '^$']];

  const cases = DATE_FORMATS[dateFormat].map(([format, regex]) =>
    timeFormats
      .map(
        ([timeFormat, timeRegex]) =>
          `WHEN ${source} ~ '${regex.slice(0, -1)}\\s*${timeRegex.slice(
            1,
          )}' THEN to_date_time_safe(${source}, '${format} ${timeFormat}')`,
      )
      .join('\n'),
  );

  return `CASE 
    ${cases.join('\n')}
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
 * Generate query to cast a value to duration.
 *
 * @param {String} source - Source column name
 * @returns {String} - query to cast value to duration
 */
function generateToDurationQuery(source: string) {
  return `
    CASE
      WHEN ${source} ~ '^\\d+:\\d{1,2}$' THEN 60 * CAST(SPLIT_PART(${source}, ':', 1) AS INT) + CAST(SPLIT_PART(${source}, ':', 2) AS INT)
      ELSE ${extractNumberQuery(source)}
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

/*
 * Generate query to cast a column to a specific data type based on the UI data type.
 *
 * @param {UITypes} uidt - UI data type
 * @param {String} dt - DB Data type
 * @param {String} source - Source column name
 * @param {Number} limit - Limit for the data type
 * @param {String} dateFormat - Date format
 * @param {String} timeFormat - Time format
 * @returns {String} - query to cast column to a specific data type
 */
export function generateCastQuery(
  uidt: UITypes,
  dt: string,
  source: string,
  limit: number,
  format: string,
) {
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
      return `CAST(${extractNumberQuery(source)} AS BIGINT);`;
    case UITypes.Year:
      return generateNumberBoundingQuery(
        extractNumberQuery(source),
        1000,
        9999,
      );
    case UITypes.Decimal:
    case UITypes.Currency:
      return `${extractNumberQuery(source)};`;
    case UITypes.Percent:
      return `LEAST(100, GREATEST(0, ${extractNumberQuery(source)}));`;
    case UITypes.Rating:
      return `LEAST(${limit || 5}, GREATEST(0, ${extractNumberQuery(
        source,
      )}));`;
    case UITypes.Checkbox:
      return generateBooleanCastQuery(source);
    case UITypes.Date:
      return `CAST(${generateDateTimeCastQuery(
        source,
        getDateFormat(format),
      ).slice(0, -1)} AS DATE);`;
    case UITypes.DateTime:
      return generateDateTimeCastQuery(source, getDateFormat(format));
    case UITypes.Time:
      return generateDateTimeCastQuery(source, 'empty');
    case UITypes.Duration:
      return generateToDurationQuery(source);
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
