import { GeneralDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.general.handler';

const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTHS_ABBR = MONTHS_FULL.map((m) => m.slice(0, 3));
const DAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const DAYS_ABBR = DAYS_FULL.map((d) => d.slice(0, 3));
const DAYS_MIN = DAYS_FULL.map((d) => d.slice(0, 2));

// SQLite — strftime has no name/12-hour tokens, so build the string piecewise.
// Each emitter returns a scalar SQL expression operating on `d` (the already
// rendered date expression).
export class SqliteDatetimeFormatHandler extends GeneralDatetimeFormatHandler {
  build(dateExpr: string, format: string): string {
    const hour24 = `cast(strftime('%H', ${dateExpr}) as integer)`;
    const hour12 = `(((${hour24} + 11) % 12) + 1)`;
    const monthSel = `strftime('%m', ${dateExpr})`;
    const weekdaySel = `strftime('%w', ${dateExpr})`;

    const emit: Record<string, string> = {
      YYYY: `strftime('%Y', ${dateExpr})`,
      YY: `substr(strftime('%Y', ${dateExpr}), -2)`,
      MMMM: this.caseFromIndex(monthSel, MONTHS_FULL, 1, 2),
      MMM: this.caseFromIndex(monthSel, MONTHS_ABBR, 1, 2),
      MM: `strftime('%m', ${dateExpr})`,
      M: `cast(strftime('%m', ${dateExpr}) as integer)`,
      Do: `cast(strftime('%d', ${dateExpr}) as integer)`,
      DD: `strftime('%d', ${dateExpr})`,
      D: `cast(strftime('%d', ${dateExpr}) as integer)`,
      dddd: this.caseFromIndex(weekdaySel, DAYS_FULL, 0, 1),
      ddd: this.caseFromIndex(weekdaySel, DAYS_ABBR, 0, 1),
      dd: this.caseFromIndex(weekdaySel, DAYS_MIN, 0, 1),
      d: `strftime('%w', ${dateExpr})`,
      HH: `strftime('%H', ${dateExpr})`,
      H: hour24,
      hh: `printf('%02d', ${hour12})`,
      h: hour12,
      mm: `strftime('%M', ${dateExpr})`,
      m: `cast(strftime('%M', ${dateExpr}) as integer)`,
      ss: `strftime('%S', ${dateExpr})`,
      s: `cast(strftime('%S', ${dateExpr}) as integer)`,
      SSS: `substr(strftime('%f', ${dateExpr}), 4)`,
      A: `CASE WHEN ${hour24} < 12 THEN 'AM' ELSE 'PM' END`,
      a: `CASE WHEN ${hour24} < 12 THEN 'am' ELSE 'pm' END`,
    };

    const pieces = this.getParts(format).map((p) => {
      if (p.literal) return this.sqlLiteral(p.value);
      return emit[p.value] ?? this.sqlLiteral(p.value);
    });

    // `''` keeps the concatenation a TEXT expression even for a single piece.
    return [`''`, ...pieces].join(' || ');
  }

  private sqlLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  // `selector` yields a string key; map it to one of `values` (indexed from
  // `start`). `width` matches how strftime pads the key — '%m' is zero-padded to
  // 2 digits, '%w' is a single digit.
  private caseFromIndex(
    selector: string,
    values: string[],
    start: number,
    width: number,
  ): string {
    const branches = values
      .map(
        (v, idx) =>
          `WHEN '${String(idx + start).padStart(
            width,
            '0',
          )}' THEN ${this.sqlLiteral(v)}`,
      )
      .join(' ');
    return `CASE ${selector} ${branches} ELSE '' END`;
  }
}
