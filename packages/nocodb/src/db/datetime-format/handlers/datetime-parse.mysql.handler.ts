import type { DatetimeParseHandler } from '~/db/datetime-format/datetime-format.interface';
import { MysqlDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.mysql.handler';
import { sqlString } from '~/db/datetime-format/handlers/datetime-format.general.handler';
import {
  escapeRegex,
  TOKEN_PATTERNS,
} from '~/db/datetime-format/handlers/datetime-parse.pg.handler';

// a shorter value (no seconds, no time) leaves the missing parts at zero
const ISO_FORMAT = '%Y-%m-%d %H:%i:%s.%f';

// valid ranges only, so 25:00 or :61 never reaches STR_TO_DATE
const ISO_DATE_PATTERN =
  '[0-9]{4}-[0-9]{2}-[0-9]{2}([T ]([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9]([.][0-9]+)?)?)?';
const ISO_OFFSET_PATTERN = 'Z|[+-][0-9]{2}:?[0-9]{2}';

// MySQL / MariaDB — STR_TO_DATE takes the same specifiers as DATE_FORMAT and
// returns NULL for text that doesn't match or an impossible date.
// Text without an offset is UTC, unlike pg / SQLite (server zone): no MySQL
// formula reads the server zone, so DATETIME_FORMAT and IS_* stay in UTC too.
export class MysqlDatetimeParseHandler
  extends MysqlDatetimeFormatHandler
  implements DatetimeParseHandler
{
  build(textExpr: string, format?: string): string {
    if (!format) {
      // inline, no derived row: MariaDB rejects an outer column inside one, so
      // the text is copied once each for the check, the parse and the offset.
      // The regex checks the whole value (STR_TO_DATE ignores trailing text);
      // the offset is applied by arithmetic, as CONVERT_TZ skips pre-1970
      const text = `TRIM(${textExpr})`;
      const parsed = `STR_TO_DATE(REPLACE(REPLACE(REGEXP_REPLACE(${text}, '(${ISO_OFFSET_PATTERN})$', ''), 'T', ' '), 't', ' '), '${ISO_FORMAT}')`;
      // `±HH[:]MM` as a signed TIME (which takes `-` but not `+`); `Z` is NULL
      const offsetSeconds = `TIME_TO_SEC(REPLACE(INSERT(REPLACE(REGEXP_SUBSTR(${text}, '(${ISO_OFFSET_PATTERN})$'), ':', ''), 4, 0, ':'), '+', ''))`;
      return `(CASE WHEN ${text} REGEXP '^${ISO_DATE_PATTERN}(${ISO_OFFSET_PATTERN})?$' THEN ${parsed} - INTERVAL COALESCE(${offsetSeconds}, 0) SECOND END)`;
    }
    const text = `TRIM(${textExpr})`;
    const parts = this.getParts(format);
    const pattern = parts
      .map((p) =>
        p.literal
          ? this.escapeLiteral(p.value)
          : this.tokens[p.value] ?? this.escapeLiteral(p.value),
      )
      .join('');
    // STR_TO_DATE ignores trailing text: the whole value must match the
    // format's regex first, the same one pg anchors on
    const regex = `^${parts
      .map(
        (p) =>
          (!p.literal && TOKEN_PATTERNS[p.value]?.[0]) || escapeRegex(p.value),
      )
      .join('')}$`;
    // STR_TO_DATE zeroes a missing year/month/day (NULL under NO_ZERO_DATE,
    // a TIME for a time-only format); fill them as Day.js and pg / SQLite do:
    // January / the 1st after a year or month, else today's
    const has = (tokens: string[]) =>
      parts.some((p) => !p.literal && tokens.includes(p.value));
    const hasYear = has(['YYYY', 'YY']);
    const hasMonth = has(['MMMM', 'MMM', 'MM', 'M']);
    const fill = [
      !hasYear && ["DATE_FORMAT(CURDATE(), '%Y')", '%Y'],
      !hasMonth && [hasYear ? "'01'" : "DATE_FORMAT(CURDATE(), '%m')", '%m'],
      !has(['DD', 'D', 'Do']) && [
        hasYear || hasMonth ? "'01'" : "DATE_FORMAT(CURDATE(), '%d')",
        '%d',
      ],
    ].filter(Boolean) as [string, string][];
    const source = fill.length
      ? `CONCAT(${fill.map(([v]) => `${v}, '|'`).join(', ')}, ${text})`
      : text;
    const sourcePattern = fill.map(([, f]) => `${f}|`).join('') + pattern;
    let parsed = `STR_TO_DATE(${source}, ${sqlString(sourcePattern)})`;
    // `%y` reads 69 as 2069; Day.js (and pg / SQLite) pivot above 68 to 19xx
    if (parts.some((p) => !p.literal && p.value === 'YY')) {
      parsed = `CASE WHEN YEAR(${parsed}) = 2069 THEN ${parsed} - INTERVAL 100 YEAR ELSE ${parsed} END`;
    }
    return `(CASE WHEN ${text} REGEXP ${sqlString(
      regex.replace(/\\/g, '\\\\'),
    )} THEN ${parsed} END)`;
  }
}
