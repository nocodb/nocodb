import { PatternDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.pattern.handler';

// MySQL / MariaDB — DATE_FORMAT pattern string.
export class MysqlDatetimeFormatHandler extends PatternDatetimeFormatHandler {
  protected readonly tokens: Record<string, string> = {
    YYYY: '%Y',
    YY: '%y',
    MMMM: '%M',
    MMM: '%b',
    MM: '%m',
    M: '%c',
    Do: '%D',
    DD: '%d',
    D: '%e',
    dddd: '%W',
    ddd: '%a',
    dd: '%a',
    d: '%w',
    HH: '%H',
    H: '%k',
    hh: '%h',
    h: '%l',
    mm: '%i',
    m: '%i',
    ss: '%s',
    s: '%s',
    SSS: '%f',
    A: '%p',
    a: '%p',
  };

  build(dateExpr: string, format: string): string {
    const parts = this.getParts(format);

    // Fast path: no sub-second token → the parent's single DATE_FORMAT call.
    if (!parts.some((p) => !p.literal && p.value === 'SSS')) {
      return super.build(dateExpr, format);
    }

    // `%f` renders 6-digit microseconds but day.js `SSS` is 3-digit
    // milliseconds, and DATE_FORMAT can't truncate inside its pattern. Assemble
    // the output with CONCAT: each contiguous non-SSS run stays a single
    // DATE_FORMAT call, and SSS becomes the left 3 digits of the microseconds.
    const ms = `LPAD(FLOOR(MICROSECOND(${dateExpr}) / 1000), 3, '0')`;
    const segments: string[] = [];
    let run = '';

    const flushRun = () => {
      if (run) {
        segments.push(this.wrap(dateExpr, run));
        run = '';
      }
    };

    for (const p of parts) {
      if (!p.literal && p.value === 'SSS') {
        flushRun();
        segments.push(ms);
      } else if (p.literal) {
        run += this.escapeLiteral(p.value);
      } else {
        run += this.tokens[p.value] ?? this.escapeLiteral(p.value);
      }
    }
    flushRun();

    return `CONCAT(${segments.join(', ')})`;
  }

  protected escapeLiteral(value: string): string {
    return value.replace(/%/g, '%%');
  }

  protected wrap(dateExpr: string, pattern: string): string {
    const escaped = pattern.replace(/'/g, "''");
    return `DATE_FORMAT(${dateExpr}, '${escaped}')`;
  }
}
