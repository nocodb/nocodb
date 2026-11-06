import dayjs from 'dayjs';
import { FormulaDataTypes, JSEPNode } from 'nocodb-sdk';
import type { MapFnArgs } from '~/db/mapFunctionName';
import { rawFromBuilder } from '~/helpers/sqlSanitize';

// WORKDAY / WORKDAY_DIFF (Airtable parity). Dates are handled as whole-day
// numbers counted from 1900-01-01, a Monday, so `day mod 7` is the weekday
// (0 = Monday … 6 = Sunday) and the weekday arithmetic is closed form. Each
// dialect only supplies the primitives below.
export interface WorkdaySqlDialect {
  // whole days from 1900-01-01 to the date part of `sql`
  dayNumber(sql: string, dataType?: FormulaDataTypes): string;
  // inverse of dayNumber, as a date
  fromDayNumber(sql: string): string;
  // date literal for a validated `YYYY-MM-DD` string
  dateLiteral(isoDate: string): string;
  // integer division where `a` is a multiple of `b`
  intDiv(a: string, b: number): string;
  mod(a: string, b: number): string;
  // `sql` truncated to an integer; non-numeric input uses its leading number
  toInteger(sql: string, isNumeric: boolean): string;
  // derived table with one nullable integer column `hn`: the day number of
  // each valid `YYYY-MM-DD` entry of the comma-separated text `sql`
  holidayDays(sql: string): string;
  // integer cast of the final WORKDAY_DIFF result
  castResult?(sql: string): string;
  // FROM clause for a select without a table (Oracle needs `FROM dual`)
  fromNothing?: string;
  // appended to a derived table to keep the planner from inlining its
  // columns: otherwise the holiday subquery in `k` runs once per use
  noInline?: string;
}

const DAY_MS = 86_400_000;
const DAY_ZERO = Date.UTC(1900, 0, 1);
const BLANKS = /^[ \t\n\r]+|[ \t\n\r]+$/g;

// Day numbers of the distinct weekday holidays in a typed holiday list, with
// the same rules as each dialect's holidayDays.
export const parseHolidayDays = (text: string): number[] => {
  const days = new Set<number>();
  for (const entry of text.split(',')) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.replace(BLANKS, ''));
    if (!m) continue;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const date = new Date(0);
    date.setUTCFullYear(y, mo - 1, d);
    if (
      y < 1 ||
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    )
      continue;
    const n = Math.round((date.getTime() - DAY_ZERO) / DAY_MS);
    if (((n % 7) + 7) % 7 < 5) days.add(n);
  }
  return [...days].sort((a, b) => a - b);
};

// non-negative modulo / floor division, valid for days before 1900 too
const floorMod = (d: WorkdaySqlDialect, x: string, b: number) =>
  d.mod(`(${d.mod(x, b)} + ${b})`, b);
const floorDiv = (d: WorkdaySqlDialect, x: string, b: number) =>
  d.intDiv(`(${x} - ${floorMod(d, x, b)})`, b);

// number of weekdays from day 0 up to and including day `x`
const weekdaysUpTo = (d: WorkdaySqlDialect, x: string) =>
  `(5 * ${floorDiv(d, x, 7)} + CASE WHEN ${floorMod(
    d,
    x,
    7,
  )} > 4 THEN 5 ELSE ${floorMod(d, x, 7)} + 1 END)`;

// day number of the k-th weekday (inverse of weekdaysUpTo)
const nthWeekday = (d: WorkdaySqlDialect, k: string) =>
  `(7 * ${floorDiv(d, `(${k} - 1)`, 5)} + ${floorMod(d, `(${k} - 1)`, 5)})`;

const isWeekday = (d: WorkdaySqlDialect, x: string) =>
  `${floorMod(d, x, 7)} < 5`;

async function argSql(
  args: MapFnArgs,
  index: number,
  lookupAgg?: string,
): Promise<string> {
  let node = args.pt.arguments[index];
  // a lookup aggregates by its parent function; pick the first value instead
  // of the default comma-joined list where a single value is expected
  if (lookupAgg && node.type === JSEPNode.IDENTIFIER) {
    node = { ...node, fnName: lookupAgg };
  }
  return `(${(await args.fn(node)).builder.toQuery()})`;
}

async function dateArgDayNumber(
  args: MapFnArgs,
  dialect: WorkdaySqlDialect,
  index: number,
) {
  const node = args.pt.arguments[index];
  if (node.type === JSEPNode.LITERAL) {
    const date = dayjs(node.value);
    if (node.value === null || node.value === '' || !date.isValid())
      return 'NULL';
    return dialect.dayNumber(dialect.dateLiteral(date.format('YYYY-MM-DD')));
  }
  return dialect.dayNumber(
    await argSql(args, index, 'FIRST'),
    node.dataType as FormulaDataTypes,
  );
}

interface HolidaysArg {
  // per-row holidays text, selected as `wdv.h`; unset for a typed list
  value?: string;
  // derived table of holiday day numbers (`hn`)
  table: string;
}

// A typed holiday list is parsed here once instead of on every row.
async function holidaysArg(
  args: MapFnArgs,
  dialect: WorkdaySqlDialect,
  index: number,
): Promise<HolidaysArg | null> {
  const node = args.pt.arguments[index];
  if (!node) return null;
  if (
    node.type === JSEPNode.LITERAL &&
    (typeof node.value === 'string' || node.value === null)
  ) {
    const days = parseHolidayDays(node.value ?? '');
    if (!days.length) return null;
    const from = dialect.fromNothing ?? '';
    return {
      table: `(${days
        .map((n, i) => `SELECT ${n}${i ? '' : ' AS hn'}${from}`)
        .join(' UNION ALL ')})`,
    };
  }
  return {
    value: await argSql(args, index),
    table: dialect.holidayDays('wdv.h'),
  };
}

// distinct weekday holidays within [lo, hi]
const holidayCount = (
  d: WorkdaySqlDialect,
  holidays: string,
  lo: string,
  hi: string,
) =>
  `(SELECT COUNT(DISTINCT wdh.hn) FROM ${holidays} wdh WHERE wdh.hn >= ${lo} AND wdh.hn <= ${hi} AND ${isWeekday(
    d,
    'wdh.hn',
  )})`;

// Holidays passed over when stepping `n` workdays from `s`. Taking weekday
// holidays in stepping order, the i-th one is passed over iff fewer than `n`
// workdays lie strictly between `s` and it — a prefix of that order, so
// counting the ones that satisfy it gives how many extra weekdays to step.
const skippedHolidays = (
  d: WorkdaySqlDialect,
  holidays: string,
  forward: boolean,
) => {
  const weekdaysBetween = forward
    ? `${weekdaysUpTo(d, 'wdr.hn')} - ${weekdaysUpTo(d, 'wdv.s')}`
    : `${weekdaysUpTo(d, '(wdv.s - 1)')} - ${weekdaysUpTo(d, 'wdr.hn')} + 1`;
  return `(SELECT COUNT(DISTINCT wdr.hn) FROM (SELECT wdh.hn, DENSE_RANK() OVER (ORDER BY wdh.hn${
    forward ? '' : ' DESC'
  }) AS rn FROM ${holidays} wdh WHERE wdh.hn ${
    forward ? '>' : '<'
  } wdv.s AND ${isWeekday(
    d,
    'wdh.hn',
  )}) wdr WHERE ${weekdaysBetween} - wdr.rn < ${forward ? 'wdv.n' : '-wdv.n'})`;
};

export const workdayFn =
  (dialect: WorkdaySqlDialect) => async (args: MapFnArgs) => {
    const start = await dateArgDayNumber(args, dialect, 0);
    const daysNode = args.pt.arguments[1];
    const days = dialect.toInteger(
      await argSql(args, 1, 'FIRST'),
      daysNode.dataType === FormulaDataTypes.NUMERIC,
    );
    const holidays = await holidaysArg(args, dialect, 2);

    const forward = holidays
      ? ` + ${skippedHolidays(dialect, holidays.table, true)}`
      : '';
    const backward = holidays
      ? ` - ${skippedHolidays(dialect, holidays.table, false)}`
      : '';

    // ordinal of the target weekday, so the result is nthWeekday(k)
    const ordinal = `CASE WHEN wdv.n > 0 THEN ${weekdaysUpTo(
      dialect,
      'wdv.s',
    )} + wdv.n${forward} WHEN wdv.n < 0 THEN ${weekdaysUpTo(
      dialect,
      '(wdv.s - 1)',
    )} + wdv.n${backward} + 1 END`;

    const dayNumber = `CASE WHEN wdk.n = 0 THEN wdk.s ELSE ${nthWeekday(
      dialect,
      'wdk.k',
    )} END`;

    return {
      builder: rawFromBuilder(
        args.knex,
        `(SELECT ${dialect.fromDayNumber(
          dayNumber,
        )} FROM (SELECT wdv.s, wdv.n, ${ordinal} AS k FROM (SELECT ${start} AS s, COALESCE(${days}, 0) AS n${
          holidays?.value ? `, ${holidays.value} AS h` : ''
        }${dialect.fromNothing ?? ''}) wdv${
          holidays ? dialect.noInline ?? '' : ''
        }) wdk)`,
      ),
    };
  };

export const workdayDiffFn =
  (dialect: WorkdaySqlDialect) => async (args: MapFnArgs) => {
    const start = await dateArgDayNumber(args, dialect, 0);
    const end = await dateArgDayNumber(args, dialect, 1);
    const holidays = await holidaysArg(args, dialect, 2);

    // weekdays in [lo, hi], both ends included, minus holidays among them
    const between = (lo: string, hi: string) =>
      `(${weekdaysUpTo(dialect, hi)} - ${weekdaysUpTo(dialect, `(${lo} - 1)`)}${
        holidays ? ` - ${holidayCount(dialect, holidays.table, lo, hi)}` : ''
      })`;

    const diff = `CASE WHEN wdv.s <= wdv.e THEN ${between(
      'wdv.s',
      'wdv.e',
    )} ELSE -${between('wdv.e', 'wdv.s')} END`;

    return {
      builder: rawFromBuilder(
        args.knex,
        `(SELECT ${
          dialect.castResult ? dialect.castResult(diff) : diff
        } FROM (SELECT ${start} AS s, ${end} AS e${
          holidays?.value ? `, ${holidays.value} AS h` : ''
        }${dialect.fromNothing ?? ''}) wdv)`,
      ),
    };
  };
