import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

/**
 * Pads a 1-2 digit fractional second to milliseconds (`10:30:45.7` →
 * `10:30:45.700`). dayjs parses an offset-less string with its own regex,
 * which reads `.7` as 7ms.
 */
export function padShortFraction<T>(value: T): T {
  if (typeof value !== 'string') return value;
  return value.replace(
    /(:\d{2}\.)(\d{1,2})(?!\d)/,
    (_, prefix: string, fraction: string) => prefix + fraction.padEnd(3, '0'),
  ) as T;
}

/**
 * Formats a DateTime value as a UTC string for a pg write, truncated to the
 * column's declared fractional-second precision (`dtxp`). Postgres rounds into
 * lower-precision columns, so `23:59:59.700` sent to a `timestamp(0)` column
 * would otherwise be stored as the next day.
 */
export function formatPgDateTime(
  value: dayjs.ConfigType | dayjs.Dayjs,
  column?: { dtxp?: string | number | null },
): string {
  let d = dayjs(padShortFraction(value)).utc();
  const precision =
    column?.dtxp === '' || column?.dtxp === null || column?.dtxp === undefined
      ? NaN
      : Number(column.dtxp);
  if (precision === 0) {
    return d.format('YYYY-MM-DD HH:mm:ssZ');
  }
  if (precision === 1 || precision === 2) {
    const step = 10 ** (3 - precision);
    d = d.millisecond(Math.floor(d.millisecond() / step) * step);
  }
  return d.format('YYYY-MM-DD HH:mm:ss.SSSZ');
}
