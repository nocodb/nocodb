import type { DatetimeParseHandler } from '~/db/datetime-format/datetime-format.interface';
import { getDatetimeFormatTimezone } from '~/db/functionMappings/commonFns';
import {
  GeneralDatetimeFormatHandler,
  sqlString,
} from '~/db/datetime-format/handlers/datetime-format.general.handler';

type Role =
  | 'year'
  | 'year2'
  | 'month'
  | 'monthName'
  | 'day'
  | 'hour'
  | 'hour12'
  | 'minute'
  | 'second'
  | 'fraction'
  | 'ms'
  | 'ampm'
  | 'offset';

// Day.js token → regex; a token with a role is captured
export const TOKEN_PATTERNS: Record<string, [string, Role?]> = {
  YYYY: ['([0-9]{4})', 'year'],
  YY: ['([0-9]{2})', 'year2'],
  MMMM: ['([A-Za-z]+)', 'monthName'],
  MMM: ['([A-Za-z]+)', 'monthName'],
  MM: ['([0-9]{2})', 'month'],
  M: ['([0-9]{1,2})', 'month'],
  Do: ['([0-9]{1,2})[nrst][dht]', 'day'],
  DD: ['([0-9]{2})', 'day'],
  D: ['([0-9]{1,2})', 'day'],
  dddd: ['[A-Za-z]+'],
  ddd: ['[A-Za-z]+'],
  dd: ['[A-Za-z]+'],
  d: ['[0-9]'],
  HH: ['([0-9]{2})', 'hour'],
  H: ['([0-9]{1,2})', 'hour'],
  hh: ['([0-9]{2})', 'hour12'],
  h: ['([0-9]{1,2})', 'hour12'],
  mm: ['([0-9]{2})', 'minute'],
  m: ['([0-9]{1,2})', 'minute'],
  ss: ['([0-9]{2})', 'second'],
  s: ['([0-9]{1,2})', 'second'],
  SSS: ['([0-9]{3})', 'ms'],
  A: ['([AaPp][Mm])', 'ampm'],
  a: ['([AaPp][Mm])', 'ampm'],
};

// no `?` anywhere: knex reads it as a binding placeholder. Two-digit month,
// day and hour, as SQLite and MySQL require.
const ISO_PATTERN =
  '^([0-9]{4})-([0-9]{2})-([0-9]{2})([T ]([0-9]{2}):([0-9]{2})(:([0-9]{2})([.]([0-9]{1,6})){0,1}){0,1}){0,1}\\s*(Z|[+-][0-9]{2}:{0,1}[0-9]{2}){0,1}$';
const ISO_ROLES: Partial<Record<Role, number>> = {
  year: 1,
  month: 2,
  day: 3,
  hour: 5,
  minute: 6,
  second: 8,
  fraction: 10,
  offset: 11,
};

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
];

// space, tab, LF, CR: btrim alone trims spaces only
const PG_TRIM_CHARS = `' ' || chr(9) || chr(10) || chr(13)`;

// lenient reading for HOUR / DATETIME_DIFF / IS_* text: Y-M-D with `-`, `/` or
// `.` and 1-2 digit parts, month first as pg reads it ("01/20/2024"), or a
// month name ("Jan 20 2024", "20 January 2024");
// a time with optional AM/PM; an offset Z, ±HH, ±HHMM or ±HH:MM
const LENIENT_TAIL =
  '([T ]\\s*([0-9]{1,2}):([0-9]{2})(:([0-9]{2})([.]([0-9]{1,6})){0,1}){0,1}\\s*([AaPp][Mm]){0,1}){0,1}\\s*([Zz]|[+-][0-9]{2}(:{0,1}[0-9]{2}){0,1}){0,1}$';
const LENIENT_YMD = `^([0-9]{4})[-/.]([0-9]{1,2})[-/.]([0-9]{1,2})${LENIENT_TAIL}`;
const LENIENT_MDY = `^([A-Za-z]{3,9}|[0-9]{1,2})[-/.\\s]+([0-9]{1,2})(st|nd|rd|th){0,1}[-/.,\\s]+([0-9]{4})${LENIENT_TAIL}`;
const LENIENT_DMY = `^([0-9]{1,2})(st|nd|rd|th){0,1}\\s+([A-Za-z]{3,9})[.,]{0,1}\\s+([0-9]{4})${LENIENT_TAIL}`;
const FULL_MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

// text → timestamptz, bare text in `timezone`; NULL (never an error) when the
// text is not a real date
export const pgLenientTextInstant = (textExpr: string, timezone = 'UTC') => {
  const monthNum = (name: string) =>
    `CASE WHEN ${name} ~ '^[0-9]{1,2}$' THEN ${name} ELSE COALESCE(array_position(ARRAY[${FULL_MONTHS.map(
      sqlString,
    ).join(',')}], lower(${name})), array_position(ARRAY[${MONTHS.map(
      sqlString,
    ).join(
      ',',
    )}], lower(${name})), CASE WHEN lower(${name}) = 'sept' THEN 9 END)::text END`;
  // [year, month, day, hour, minute, second, fraction, ampm, offset]
  const parts = `CASE WHEN _lm.a IS NOT NULL THEN ARRAY[_lm.a[1], _lm.a[2], _lm.a[3], _lm.a[5], _lm.a[6], _lm.a[8], _lm.a[10], _lm.a[11], _lm.a[12]] WHEN _lm.b IS NOT NULL THEN ARRAY[_lm.b[4], ${monthNum(
    '_lm.b[1]',
  )}, _lm.b[2], _lm.b[6], _lm.b[7], _lm.b[9], _lm.b[11], _lm.b[12], _lm.b[13]] WHEN _lm.c IS NOT NULL THEN ARRAY[_lm.c[4], ${monthNum(
    '_lm.c[3]',
  )}, _lm.c[1], _lm.c[6], _lm.c[7], _lm.c[9], _lm.c[11], _lm.c[12], _lm.c[13]] END`;

  const p = (i: number) => `_lp.p[${i}]`;
  const year = `${p(1)}::int`;
  const month = `${p(2)}::int`;
  const day = `${p(3)}::int`;
  const rawHour = `COALESCE(${p(4)}::int, 0)`;
  const ampm = p(8);
  const hour = `(CASE WHEN ${ampm} IS NULL THEN ${rawHour} ELSE ${rawHour} % 12 + CASE WHEN upper(${ampm}) = 'PM' THEN 12 ELSE 0 END END)`;
  const minute = `COALESCE(${p(5)}::int, 0)`;
  const second = `(COALESCE(${p(6)}::int, 0) + COALESCE(('0.' || ${p(
    7,
  )})::float8, 0))`;
  const offset = p(9);
  const offsetMinutes = `(CASE WHEN upper(${offset}) = 'Z' THEN 0 ELSE (CASE WHEN left(${offset}, 1) = '-' THEN -1 ELSE 1 END) * (substr(${offset}, 2, 2)::int * 60 + CASE WHEN length(${offset}) > 3 THEN right(${offset}, 2)::int ELSE 0 END) END)`;
  const local = (tz: string) =>
    `make_timestamptz(${year}, ${month}, ${day}, ${hour}, ${minute}, ${second}, ${tz})`;
  const inRange = [
    `${p(2)} IS NOT NULL`,
    `${year} BETWEEN 1 AND 9999`,
    `${month} BETWEEN 1 AND 12`,
    `${day} >= 1`,
    `(CASE WHEN ${ampm} IS NULL THEN ${rawHour} BETWEEN 0 AND 23 ELSE ${rawHour} BETWEEN 1 AND 12 END)`,
    `${minute} BETWEEN 0 AND 59`,
    `COALESCE(${p(6)}::int, 0) BETWEEN 0 AND 59`,
    `(${offset} IS NULL OR upper(${offset}) = 'Z' OR (substr(${offset}, 2, 2)::int <= 23 AND (length(${offset}) = 3 OR right(${offset}, 2)::int <= 59)))`,
  ].join(' AND ');
  const lastDay = `EXTRACT(DAY FROM (make_date(${year}, ${month}, 1) + INTERVAL '1 month - 1 day'))`;
  const instant = `(CASE WHEN ${offset} IS NULL THEN ${local(
    sqlString(timezone),
  )} ELSE ${local(`'UTC'`)} - ${offsetMinutes} * INTERVAL '1 minute' END)`;

  // OFFSET 0 keeps each match from running once per part
  return `(SELECT CASE WHEN _lp.p IS NOT NULL AND ${inRange} THEN CASE WHEN ${day} <= ${lastDay} THEN ${instant} END END FROM (SELECT ${parts} AS p FROM (SELECT regexp_match(_lt.t, ${sqlString(
    LENIENT_YMD,
  )}) AS a, regexp_match(_lt.t, ${sqlString(
    LENIENT_MDY,
  )}) AS b, regexp_match(_lt.t, ${sqlString(
    LENIENT_DMY,
  )}) AS c FROM (SELECT btrim((${textExpr})::text, ${PG_TRIM_CHARS}) AS t OFFSET 0) _lt OFFSET 0) _lm OFFSET 0) _lp)`;
};

export const escapeRegex = (value: string) =>
  value.replace(/[.*+^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '\\x3f');

// PostgreSQL — match the text against a regex built from the format, then
// assemble the parts. make_timestamptz raises on an impossible date, so the
// parts are range-checked first, in CASEs so it never sees bad input.
export class PgDatetimeParseHandler
  extends GeneralDatetimeFormatHandler
  implements DatetimeParseHandler
{
  build(textExpr: string, format?: string, timezone = 'UTC'): string {
    let pattern = ISO_PATTERN;
    let roles = ISO_ROLES;
    if (format) {
      roles = {};
      let group = 0;
      pattern = `^${this.getParts(format)
        .map((part) => {
          const token = !part.literal && TOKEN_PATTERNS[part.value];
          if (!token) return escapeRegex(part.value);
          const [regex, role] = token;
          if (role) {
            group++;
            roles[role] ??= group;
          }
          return regex;
        })
        .join('')}$`;
    }

    // a missing year/month/day is today's, in the zone TODAY() uses
    const todayZone = (getDatetimeFormatTimezone() ?? 'UTC').replace(
      /'/g,
      "''",
    );
    const todayPart = (field: string) =>
      `EXTRACT(${field} FROM (NOW() AT TIME ZONE '${todayZone}'))::int`;
    const part = (role: Role) => `_dp.r[${roles[role]}]`;
    const int = (role: Role) => `(${part(role)})::int`;

    const year = roles.year
      ? int('year')
      : roles.year2
      ? `(CASE WHEN ${int('year2')} > 68 THEN 1900 ELSE 2000 END + ${int(
          'year2',
        )})`
      : todayPart('YEAR');
    const month = roles.month
      ? int('month')
      : roles.monthName
      ? `array_position(ARRAY[${MONTHS.map(sqlString).join(
          ',',
        )}], lower(substr(${part('monthName')}, 1, 3)))`
      : // a missing month/day is Day.js': January after a year, else now's
      roles.year || roles.year2
      ? '1'
      : todayPart('MONTH');
    const day = roles.day
      ? `COALESCE(${int('day')}, 1)`
      : roles.year || roles.year2 || roles.month || roles.monthName
      ? '1'
      : todayPart('DAY');
    const hour = roles.hour
      ? `COALESCE(${int('hour')}, 0)`
      : roles.hour12
      ? roles.ampm
        ? `(${int('hour12')} % 12 + CASE WHEN upper(${part(
            'ampm',
          )}) = 'PM' THEN 12 ELSE 0 END)`
        : int('hour12')
      : '0';
    const minute = roles.minute ? `COALESCE(${int('minute')}, 0)` : '0';
    const second = roles.second ? `COALESCE(${int('second')}, 0)` : '0';
    const fraction = roles.fraction
      ? ` + COALESCE(('0.' || ${part('fraction')})::float8, 0)`
      : roles.ms
      ? ` + ${int('ms')} / 1000.0`
      : '';

    const inRange = [
      `${year} BETWEEN 1 AND 9999`,
      `${month} BETWEEN 1 AND 12`,
      `${day} >= 1`,
      `${hour} BETWEEN 0 AND 23`,
      `${minute} BETWEEN 0 AND 59`,
      `${second} BETWEEN 0 AND 59`,
      ...(roles.hour12 && roles.ampm
        ? [`${int('hour12')} BETWEEN 1 AND 12`]
        : []),
    ].join(' AND ');

    const lastDay = `EXTRACT(DAY FROM (make_date(${year}, ${month}, 1) + INTERVAL '1 month - 1 day'))`;
    const local = (tz: string) =>
      `make_timestamptz(${year}, ${month}, ${day}, ${hour}, ${minute}, ${second}${fraction}, ${tz})`;

    let instant = local(sqlString(timezone));
    if (roles.offset) {
      const offset = part('offset');
      // `±HH:MM` / `±HHMM`, applied by hand: pg reads a bare offset given
      // as a zone name with the POSIX (inverted) sign
      const offsetMinutes = `(CASE WHEN ${offset} = 'Z' THEN 0 ELSE (CASE WHEN left(${offset}, 1) = '-' THEN -1 ELSE 1 END) * (substr(${offset}, 2, 2)::int * 60 + right(${offset}, 2)::int) END)`;
      instant = `(CASE WHEN ${offset} IS NULL THEN ${instant} ELSE ${local(
        `'UTC'`,
      )} - ${offsetMinutes} * INTERVAL '1 minute' END)`;
    }

    // OFFSET 0: inlined, the match (and the text) would run once per `_dp.r[i]`
    return `(SELECT CASE WHEN _dp.r IS NOT NULL AND ${inRange} THEN CASE WHEN ${day} <= ${lastDay} THEN ${instant} END END FROM (SELECT regexp_match(btrim((${textExpr})::text, ${PG_TRIM_CHARS}), ${sqlString(
      pattern,
    )}) AS r OFFSET 0) _dp)`;
  }
}
