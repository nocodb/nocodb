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

export function generateCastQuery(
  uidt: UITypes,
  source: string,
  limit: number,
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
    case UITypes.DateTime:
    case UITypes.Time:
      return `CAST(${source} AS TIMESTAMP);`;
    case UITypes.Duration:
      return `CAST(${extractNumberQuery(source)} AS INTEGER);`;
    case UITypes.SingleSelect:
      return generateSingleSelectCastQuery(source, []);
    case UITypes.MultiSelect:
      return `${source}::ARRAY;`;
  }
}

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
