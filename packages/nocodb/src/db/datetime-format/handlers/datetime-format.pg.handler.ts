import { PatternDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.pattern.handler';

// PostgreSQL — TO_CHAR pattern string.
export class PgDatetimeFormatHandler extends PatternDatetimeFormatHandler {
  protected readonly tokens: Record<string, string> = {
    YYYY: 'YYYY',
    YY: 'YY',
    MMMM: 'FMMonth',
    MMM: 'Mon',
    MM: 'MM',
    M: 'FMMM',
    Do: 'FMDDth',
    DD: 'DD',
    D: 'FMDD',
    dddd: 'FMDay',
    ddd: 'Dy',
    dd: 'Dy',
    d: 'D',
    HH: 'HH24',
    H: 'FMHH24',
    hh: 'HH12',
    h: 'FMHH12',
    mm: 'MI',
    m: 'FMMI',
    ss: 'SS',
    s: 'FMSS',
    SSS: 'MS',
    A: 'AM',
    a: 'am',
  };

  protected escapeLiteral(value: string): string {
    return `"${value.replace(/["\\]/g, '\\$&')}"`;
  }

  protected wrap(dateExpr: string, pattern: string): string {
    const escaped = pattern.replace(/'/g, "''");
    return `TO_CHAR((${dateExpr})::timestamp, '${escaped}')`;
  }
}
