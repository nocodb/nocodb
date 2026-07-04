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

  protected escapeLiteral(value: string): string {
    return value.replace(/%/g, '%%');
  }

  protected wrap(dateExpr: string, pattern: string): string {
    const escaped = pattern.replace(/'/g, "''");
    return `DATE_FORMAT(${dateExpr}, '${escaped}')`;
  }
}
