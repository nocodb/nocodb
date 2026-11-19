import type { DatetimeParseHandler } from '~/db/datetime-format/datetime-format.interface';
import {
  GeneralDatetimeFormatHandler,
  sqlString,
} from '~/db/datetime-format/handlers/datetime-format.general.handler';
import { NcError } from '~/helpers/catchError';

// fixed-width tokens only: without regex, parts are read by position
const TOKEN_WIDTHS: Record<string, number> = {
  YYYY: 4,
  YY: 2,
  MM: 2,
  DD: 2,
  HH: 2,
  hh: 2,
  mm: 2,
  ss: 2,
  SSS: 3,
  A: 2,
  a: 2,
};

// SQLite — datetime() reads ISO text and returns NULL for anything else. It
// accepts days up to 31 in any month, so the julianday round trip (which
// normalises Feb 30 to Mar 2) rejects impossible dates. A format is matched
// position by position.
export class SqliteDatetimeParseHandler
  extends GeneralDatetimeFormatHandler
  implements DatetimeParseHandler
{
  build(textExpr: string, format?: string): string {
    // the text is trimmed once in a derived row (a lookup is a subquery)
    const text = 'nc_dt.t';
    const fromText = `FROM (SELECT trim(${textExpr}) AS t) nc_dt`;
    if (!format) {
      // the date part alone: an offset can move the instant to another day.
      // A UTC instant, as pg's timestamptz: datetime() applies an offset;
      // text without one is server-local time. SQLite reads only `±HH:MM`,
      // so `±HHMM` gets its colon; %f keeps milliseconds (datetime() drops them),
      // and whole seconds keep datetime()'s shape, as the format path returns.
      // Marked +00:00 like a stored DateTime, so DATEADD's 'utc' leaves it
      const ts = `strftime('%Y-%m-%d %H:%M:%f', ${text}`;
      const value = `(SELECT CASE WHEN date(substr(${text}, 1, 10)) = substr(${text}, 1, 10) THEN CASE WHEN ${text} GLOB '*[+-][0-9][0-9]:[0-9][0-9]' OR ${text} GLOB '*[Zz]' THEN ${ts}) ELSE ${ts}, 'utc') END END FROM (SELECT CASE WHEN length(nc_dt0.t) > 10 AND nc_dt0.t GLOB '*[+-][0-9][0-9][0-9][0-9]' THEN substr(nc_dt0.t, 1, length(nc_dt0.t) - 2) || ':' || substr(nc_dt0.t, -2) ELSE nc_dt0.t END AS t FROM (SELECT trim(${textExpr}) AS t) nc_dt0) nc_dt)`;
      return `(SELECT CASE WHEN substr(nc_v.v, -4) = '.000' THEN substr(nc_v.v, 1, 19) ELSE nc_v.v END || '+00:00' FROM (SELECT ${value} AS v) nc_v)`;
    }

    const checks: string[] = [];
    const at: Record<string, string> = {};
    let pos = 1;
    for (const part of this.getParts(format)) {
      if (part.literal) {
        checks.push(
          `substr(${text}, ${pos}, ${part.value.length}) = ${sqlString(
            part.value,
          )}`,
        );
        pos += part.value.length;
        continue;
      }
      const width = TOKEN_WIDTHS[part.value];
      if (!width) {
        NcError.badRequest(
          `DATETIME_PARSE on SQLite supports fixed-width tokens only (${Object.keys(
            TOKEN_WIDTHS,
          ).join(', ')}), not "${part.value}"`,
        );
      }
      const slice = `substr(${text}, ${pos}, ${width})`;
      if (part.value === 'A' || part.value === 'a') {
        checks.push(`upper(${slice}) IN ('AM', 'PM')`);
      } else {
        checks.push(`${slice} GLOB '${'[0-9]'.repeat(width)}'`);
      }
      at[part.value] ??= slice;
      pos += width;
    }
    checks.push(`length(${text}) = ${pos - 1}`);

    const int = (sql: string) => `CAST(${sql} AS INTEGER)`;
    const year = at.YYYY
      ? int(at.YYYY)
      : at.YY
      ? `(${int(at.YY)} + CASE WHEN ${int(at.YY)} > 68 THEN 1900 ELSE 2000 END)`
      : `CAST(strftime('%Y', 'now', 'localtime') AS INTEGER)`;
    const hour12 = at.hh ?? null;
    const ampm = at.A ?? at.a ?? null;
    const hour = at.HH
      ? int(at.HH)
      : hour12 && ampm
      ? `(${int(
          hour12,
        )} % 12 + CASE WHEN upper(${ampm}) = 'PM' THEN 12 ELSE 0 END)`
      : hour12
      ? int(hour12)
      : '0';
    // a missing month/day is Day.js': January after a year, else today's
    // (local, as TODAY() is)
    const hasYear = !!(at.YYYY || at.YY);
    const month = at.MM
      ? int(at.MM)
      : hasYear
      ? '1'
      : `CAST(strftime('%m', 'now', 'localtime') AS INTEGER)`;
    const day = at.DD
      ? int(at.DD)
      : hasYear || at.MM
      ? '1'
      : `CAST(strftime('%d', 'now', 'localtime') AS INTEGER)`;
    if (hour12 && ampm) checks.push(`${int(hour12)} BETWEEN 1 AND 12`);
    const iso = `printf('%04d-%02d-%02d %02d:%02d:%02d', ${year}, ${month}, ${day}, ${hour}, ${
      at.mm ? int(at.mm) : 0
    }, ${at.ss ? int(at.ss) : 0})`;

    return `(SELECT CASE WHEN ${checks.join(
      ' AND ',
    )} AND datetime(julianday(${iso})) = ${iso} THEN datetime(${iso}, 'utc') || '+00:00' END ${fromText})`;
  }
}
