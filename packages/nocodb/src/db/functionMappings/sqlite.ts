import dayjs from 'dayjs';
import {
  ClientType,
  convertToTargetFormat,
  FormulaDataTypes,
  getDateFormat,
  JSEPNode,
  UITypes,
} from 'nocodb-sdk';
import commonFns, {
  escapePlaceholders,
  extractDatetimeFormat,
  getDatetimeFormatTimezone,
  isDatetimeInstantNode,
  jsonPathFromLiteral,
  safeDateAddUnitSQL,
  validateDateAddUnit,
} from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import type { WorkdaySqlDialect } from '~/db/functionMappings/workday';
import type { DateCompareSqlDialect } from '~/db/functionMappings/dateCompare';
import type { TextOccurrenceSqlDialect } from '~/db/functionMappings/textOccurrence';
import { convertUnits } from '~/helpers/convertUnits';
import { NcError } from '~/helpers/catchError';
import {
  getWeekdayByText,
  getWeekStartOffsetSunday,
} from '~/helpers/formulaFnHelper';
import {
  getDatetimeFormatHandler,
  getDatetimeParseHandler,
} from '~/db/datetime-format';
import { workdayDiffFn, workdayFn } from '~/db/functionMappings/workday';
import {
  isAfterFn,
  isBeforeFn,
  isSameFn,
  parseLiteralDate,
} from '~/db/functionMappings/dateCompare';
import {
  substituteFn,
  textAfterFn,
  textBeforeFn,
} from '~/db/functionMappings/textOccurrence';

// julianday('1900-01-01')
const SQLITE_JULIAN_1900 = 2415020.5;
const SQLITE_BLANKS = `' ' || char(9, 10, 13)`;

const sqliteWorkdayDialect: WorkdaySqlDialect = {
  dayNumber: (sql) =>
    `CAST(round(julianday(date(${sql})) - ${SQLITE_JULIAN_1900}) AS INTEGER)`,
  fromDayNumber: (sql) => `date(${SQLITE_JULIAN_1900} + (${sql}))`,
  dateLiteral: (isoDate) => `'${isoDate}'`,
  intDiv: (a, b) => `(${a} / ${b})`,
  mod: (a, b) => `(${a} % ${b})`,
  // CAST takes the leading number of a text value and truncates toward zero
  toInteger: (sql) => `CAST(${sql} AS INTEGER)`,
  // splits on commas with a recursive CTE; the julianday round trip keeps
  // real dates only (date() alone accepts e.g. 2026-02-30)
  holidayDays: (sql) =>
    `(WITH RECURSIVE wds(t, r) AS (SELECT NULL, CAST(${sql} AS TEXT) || ',' UNION ALL SELECT trim(substr(r, 1, instr(r, ',') - 1), ${SQLITE_BLANKS}), substr(r, instr(r, ',') + 1) FROM wds WHERE r <> '') SELECT CASE WHEN length(t) = 10 AND date(julianday(t)) = t THEN CAST(round(julianday(t) - ${SQLITE_JULIAN_1900}) AS INTEGER) END AS hn FROM wds)`,
  // the flattener skips a subquery with an OFFSET
  noInline: ' LIMIT -1 OFFSET 0',
};

// zero-padded text sorts in time order
const SQLITE_TRUNCATE_FORMATS: Record<string, string> = {
  year: '%Y',
  month: '%Y-%m',
  day: '%Y-%m-%d',
  hour: '%Y-%m-%d %H',
  minute: '%Y-%m-%d %H:%M',
  second: '%Y-%m-%d %H:%M:%S',
};

// A stored instant (a DateTime-type field, CREATED_TIME(), or DATEADD / IF /
// SWITCH over them) is UTC; NOW() and TODAY() are already local. As on pg, DATETIME_FORMAT and IS_* read a stored
// instant in the server zone, so all of them agree on the day.
const sqliteLocalInstant = (sql: string, node: MapFnArgs['pt']) =>
  getDatetimeFormatTimezone() && isDatetimeInstantNode(node, true)
    ? // strftime %f, not datetime(): that drops milliseconds
      `strftime('%Y-%m-%d %H:%M:%f', ${sql}, 'localtime')`
    : sql;

// SQLite reads only `±HH:MM`, so `±HHMM` gets its colon (`col` is a column)
const sqliteColonOffset = (col: string) =>
  `CASE WHEN length(${col}) > 10 AND ${col} GLOB '*[+-][0-9][0-9][0-9][0-9]' THEN substr(${col}, 1, length(${col}) - 2) || ':' || substr(${col}, -2) ELSE ${col} END`;

const sqliteHasZone = (col: string) =>
  `(${col} GLOB '*[+-][0-9][0-9]:[0-9][0-9]' OR ${col} GLOB '*[Zz]')`;

// text is read as pg's time parts read it: a date (else NULL, where bare
// strftime reads '10:30' or '12345'), an offset applied, no offset as UTC
const sqliteTimePart = async (fn: MapFnArgs['fn'], node: MapFnArgs['pt']) => {
  const sql = `(${(await fn(node)).builder.toQuery()})`;
  return node?.dataType === FormulaDataTypes.STRING
    ? `(SELECT CASE WHEN date(substr(nc_tp.t, 1, 10)) = substr(nc_tp.t, 1, 10) THEN datetime(julianday(nc_tp.t)) END FROM (SELECT ${sqliteColonOffset(
        'nc_tp0.t',
      )} AS t FROM (SELECT trim(${sql}) AS t) nc_tp0) nc_tp)`
    : sql;
};

// text with a zone is an instant: read in the server zone, as stored ones are
const sqliteTextAsLocal = (sql: string) => {
  const t = getDatetimeFormatTimezone()
    ? `CASE WHEN ${sqliteHasZone(
        'nc_tl.t',
      )} THEN strftime('%Y-%m-%d %H:%M:%f', nc_tl.t, 'localtime') ELSE nc_tl.t END`
    : 'nc_tl.t';
  return `(SELECT ${t} FROM (SELECT ${sqliteColonOffset(
    'nc_tl0.t',
  )} AS t FROM (SELECT trim(${sql}) AS t) nc_tl0) nc_tl)`;
};

const sqliteDateCompareDialect: DateCompareSqlDialect = {
  truncate: (raw, unit, dataType) => {
    const sql =
      dataType === FormulaDataTypes.STRING ? sqliteTextAsLocal(raw) : raw;
    return unit === 'week'
      ? `date(${sql}, 'weekday 0', '-6 days')`
      : `strftime('${
          unit ? SQLITE_TRUNCATE_FORMATS[unit] : '%Y-%m-%d %H:%M:%f'
        }', ${sql})`;
  },
  datetimeLiteral: (iso) => `'${iso}'`,
  localInstant: sqliteLocalInstant,
};

const sqliteTextOccurrenceDialect: TextOccurrenceSqlDialect = {
  isWhole: (sql) => `(CAST(${sql} AS INTEGER) = ${sql})`,
  // every occurrence, numbered, via a recursive CTE; then the n-th from either
  // end. Not LIMIT/OFFSET: those can't read an outer column (a field as n).
  occurrence: (text, delim, n) =>
    `COALESCE((WITH RECURSIVE _occ(p, c) AS (SELECT instr(${text}, ${delim}), 1 WHERE length(${delim}) > 0 UNION ALL SELECT p + length(${delim}) - 1 + instr(substr(${text}, p + length(${delim})), ${delim}), c + 1 FROM _occ WHERE p > 0 AND instr(substr(${text}, p + length(${delim})), ${delim}) > 0) SELECT p FROM _occ WHERE p > 0 AND c = CASE WHEN ${n} > 0 THEN ${n} ELSE (SELECT count(*) FROM _occ WHERE p > 0) + ${n} + 1 END), 0)`,
  substr: (text, from, length) =>
    length ? `substr(${text}, ${from}, ${length})` : `substr(${text}, ${from})`,
  length: (sql) => `length(${sql})`,
  concat: (parts) => `(${parts.join(' || ')})`,
};

// scalar min() / max() take two or more arguments: min(x) is the aggregate
const minMaxFn = async ({ fn, knex, pt }: MapFnArgs) =>
  pt.arguments?.length === 1
    ? { builder: knex.raw(`(${(await fn(pt.arguments[0])).builder})`) }
    : undefined;

const sqlite3 = {
  ...commonFns,
  // as pg: COUNT counts number-typed arguments, COUNTA non-blank ones
  COUNT: async ({ fn, knex, pt }: MapFnArgs) => {
    const builders = await Promise.all(pt.arguments.map((arg) => fn(arg)));
    const parts = pt.arguments.map((arg, i) =>
      // booleans (checkboxes, comparisons) are integers here but not on pg
      arg.referencedColumn?.uidt === UITypes.Checkbox ||
      [
        FormulaDataTypes.BOOLEAN,
        FormulaDataTypes.COND_EXP,
        FormulaDataTypes.LOGICAL,
      ].includes(arg.dataType)
        ? knex.raw('0')
        : knex.raw(
            `CASE WHEN typeof(?) IN ('integer', 'real') THEN 1 ELSE 0 END`,
            [builders[i].builder],
          ),
    );
    return { builder: knex.raw(parts.map(() => '?').join(' + '), parts) };
  },
  COUNTA: async ({ fn, knex, pt }: MapFnArgs) => {
    const parts = (await Promise.all(pt.arguments.map((arg) => fn(arg)))).map(
      ({ builder }) =>
        knex.raw(
          `CASE WHEN ? IS NOT NULL AND CAST(? AS TEXT) <> '' THEN 1 ELSE 0 END`,
          [builder, builder],
        ),
    );
    return { builder: knex.raw(parts.map(() => '?').join(' + '), parts) };
  },
  LEN: 'LENGTH',
  MIN: minMaxFn,
  MAX: minMaxFn,
  async CEILING(args) {
    return {
      builder: args.knex.raw(
        `round(${(await args.fn(args.pt.arguments[0])).builder} + 0.5)`,
      ),
    };
  },
  async FLOOR(args) {
    return {
      builder: args.knex.raw(
        `round(${(await args.fn(args.pt.arguments[0])).builder} - 0.5)`,
      ),
    };
  },
  MOD: async (args: MapFnArgs) => {
    return args.fn({
      type: 'BinaryExpression',
      operator: '%',
      left: args.pt.arguments[0],
      right: args.pt.arguments[1],
    });
  },
  async REPEAT(args: MapFnArgs) {
    return {
      builder: args.knex.raw(
        `replace(printf('%.' || ${
          (await args.fn(args.pt.arguments[1])).builder
        } || 'c', '/'),'/',${(await args.fn(args.pt.arguments[0])).builder})`,
      ),
    };
  },
  NOW: (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(`DATETIME('now', 'localtime')`),
    };
  },
  SEARCH: 'INSTR',
  async INT(args: MapFnArgs) {
    return {
      builder: args.knex.raw(
        `CAST(${(await args.fn(args.pt.arguments[0])).builder} as INTEGER)`,
      ),
    };
  },
  LEFT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const length = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,1,?)`, [source, length]),
    };
  },
  RIGHT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const length = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,-(?))`, [source, length]),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(`CAST(${(await args.fn(args.pt.arguments[0])).builder} as FLOAT)`)
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const amountBuilder = (await fn(pt.arguments[1])).builder;
    const dateIN = Number(
      typeof amountBuilder === 'object' && amountBuilder.toQuery
        ? amountBuilder.toQuery()
        : amountBuilder,
    );
    // A field reference or expression isn't a literal number, so build the
    // modifier's amount in SQL instead of inlining NaN
    const isLiteralAmount = !Number.isNaN(dateIN);
    const amountSql = knex.raw(`CAST(? AS TEXT) || ' '`, [amountBuilder]);

    if (pt.arguments[2].type === 'Literal') {
      let dateModifier = (await fn(pt.arguments[2])).builder;
      if (typeof dateModifier === 'object' && dateModifier.toQuery) {
        dateModifier = dateModifier.toQuery();
      }
      const unit = validateDateAddUnit(String(dateModifier));
      if (!isLiteralAmount) {
        const fullModifier = knex.raw(`? || '${unit}'`, [amountSql]);
        return {
          builder: knex.raw(
            `CASE
        WHEN ? LIKE '%:%' THEN
          STRFTIME('%Y-%m-%dT%H:%M:%fZ', DATETIME(?, 'utc', ?))
        ELSE
          DATE(?, ?)
        END`,
            [source, source, fullModifier, source, fullModifier],
          ),
        };
      }
      const fullModifierRaw = `${dateIN > 0 ? '+' : ''}${dateIN} ${unit}`;

      return {
        builder: knex.raw(
          `CASE
        WHEN :source LIKE '%:%' THEN
          STRFTIME('%Y-%m-%dT%H:%M:%fZ', DATETIME(:source, 'utc', ':fullModifier'))
        ELSE
          DATE(:source, ':fullModifier')
        END`,
          {
            source,
            fullModifier: knex.raw(fullModifierRaw),
          },
        ),
      };
    }

    // Dynamic unit (field reference) — build modifier as a SQL expression
    // with proper ? bindings so knex nests the Raw correctly
    const unitBuilder = (await fn(pt.arguments[2])).builder;
    const safeUnit = safeDateAddUnitSQL(knex, unitBuilder);
    const fullModifier = isLiteralAmount
      ? knex.raw(`'${dateIN > 0 ? '+' : ''}${dateIN} ' || ?`, [safeUnit])
      : knex.raw(`? || ?`, [amountSql, safeUnit]);

    return {
      builder: knex.raw(
        `CASE
      WHEN ? LIKE '%:%' THEN
        STRFTIME('%Y-%m-%dT%H:%M:%fZ', DATETIME(?, 'utc', ?))
      ELSE
        DATE(?, ?)
      END`,
        [source, source, fullModifier, source, fullModifier],
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
    let datetime_expr1 = (await fn(pt.arguments[0])).builder;
    let datetime_expr2 = (await fn(pt.arguments[1])).builder;
    // JULIANDAY takes YYYY-MM-DD
    if (datetime_expr1.sql === '?' && datetime_expr1.bindings?.[0]) {
      datetime_expr1 = `'${convertToTargetFormat(
        datetime_expr1.bindings[0],
        getDateFormat(datetime_expr1.bindings[0]),
        'YYYY-MM-DD',
      )}'`;
    }

    if (datetime_expr2.sql === '?' && datetime_expr2.bindings?.[0]) {
      datetime_expr2 = `'${convertToTargetFormat(
        datetime_expr2.bindings[0],
        getDateFormat(datetime_expr2.bindings[0]),
        'YYYY-MM-DD',
      )}'`;
    }
    // A side is UTC when it is a known instant or its text has a zone; NOW()
    // and plain text are local. A UTC side moves to local only against a
    // local side: two UTC sides subtract as they are (no DST)
    const sides = [datetime_expr1, datetime_expr2].map(
      (expr) => `(${typeof expr === 'string' ? expr : expr.toQuery()})`,
    );
    const isUtc = [0, 1].map((i) =>
      isDatetimeInstantNode(pt.arguments[i], true)
        ? '1'
        : sqliteHasZone(`nc_dd0.${'ab'[i]}`),
    );
    const shifted = (i: number) =>
      getDatetimeFormatTimezone()
        ? `CASE WHEN ${isUtc[i]} AND NOT ${
            isUtc[1 - i]
          } THEN strftime('%Y-%m-%d %H:%M:%f', nc_dd0.${
            'ab'[i]
          }, 'localtime') ELSE nc_dd0.${'ab'[i]} END`
        : `nc_dd0.${'ab'[i]}`;
    const diffFrom = `FROM (SELECT ${shifted(0)} AS a, ${shifted(
      1,
    )} AS b FROM (SELECT ${sqliteColonOffset(
      'nc_dr.a',
    )} AS a, ${sqliteColonOffset('nc_dr.b')} AS b FROM (SELECT ${
      sides[0]
    } AS a, ${sides[1]} AS b LIMIT -1 OFFSET 0) nc_dr) nc_dd0) nc_dd`;
    datetime_expr1 = 'nc_dd.a';
    datetime_expr2 = 'nc_dd.b';

    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    let sql;
    const unit = convertUnits(rawUnit, 'sqlite');
    switch (unit) {
      case 'seconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2}))`;
        break;
      case 'minutes':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 60`;
        break;
      case 'hours':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 3600`;
        break;
      case 'milliseconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) * 1000`;
        break;
      case 'weeks':
        sql = `ROUND((JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})) / 7)`;
        break;
      case 'months':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 12 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) `;
        break;
      case 'quarters':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 4 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) / 3`;
        break;
      case 'years':
        sql = `CASE
                WHEN (${datetime_expr2} < ${datetime_expr1}) THEN
                (
                  (strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2}))
                  - (strftime('%m', ${datetime_expr1}) < strftime('%m', ${datetime_expr2})
                  OR (strftime('%m', ${datetime_expr1}) = strftime('%m', ${datetime_expr2})
                  AND strftime('%d', ${datetime_expr1}) < strftime('%d', ${datetime_expr2})))
                )
                WHEN (${datetime_expr2} > ${datetime_expr1}) THEN
                -1 * (
                  (strftime('%Y', ${datetime_expr2}) - strftime('%Y', ${datetime_expr1}))
                  - (strftime('%m', ${datetime_expr2}) < strftime('%m', ${datetime_expr1})
                  OR (strftime('%m', ${datetime_expr2}) = strftime('%m', ${datetime_expr1})
                  AND strftime('%d', ${datetime_expr2}) < strftime('%d', ${datetime_expr1})))
                )
                ELSE 0
              END`;
        break;
      case 'days':
        sql = `JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})`;
        break;
      default:
        sql = '';
    }
    return {
      builder: knex.raw(
        escapePlaceholders(`(SELECT ROUND(${sql}) ${diffFrom})`),
      ),
    };
  },
  // |DATETIME_DIFF(NOW(), date, unit)| as pg computes it. A stored DateTime, or
  // text with an offset, is UTC; anything else is local wall time like NOW() and
  // TODAY(), so it is measured against local 'now'.
  FROMNOW: async ({ fn, knex, pt }: MapFnArgs) => {
    const node = pt.arguments[0];
    const date =
      node.type === JSEPNode.LITERAL && typeof node.value === 'string'
        ? parseLiteralDate(node.value)
        : null;
    const value = date
      ? knex.raw('?', [
          date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss.SSS') : null,
        ])
      : (await fn(node)).builder;
    const nowJd = isDatetimeInstantNode(node, true)
      ? `julianday('now')`
      : `CASE WHEN nc_fw.t GLOB '*[+-][0-9][0-9]:[0-9][0-9]' OR nc_fw.t GLOB '*[Zz]' THEN julianday('now') ELSE julianday('now', 'localtime') END`;
    const rawUnit = pt.arguments[1]
      ? (await fn(pt.arguments[1])).builder.bindings[0]
      : 'days';
    // a / b: the later / earlier instant as julian days; whole milliseconds
    // first, so float error can't move a .5 second or a day boundary
    const ms = `ROUND((nc_fn.a - nc_fn.b) * 86400000)`;
    const seconds = `CAST(ROUND(${ms} / 1000) AS INTEGER)`;
    const days = `CAST(${ms} / 86400000 AS INTEGER)`;
    const part = (f: string, jd: string) =>
      `CAST(strftime('${f}', ${jd}) AS INTEGER)`;
    const yearDiff = `(${part('%Y', 'nc_fn.a')} - ${part('%Y', 'nc_fn.b')})`;
    let sql: string;
    switch (convertUnits(rawUnit, 'sqlite')) {
      case 'milliseconds':
        sql = `${seconds} * 1000`;
        break;
      case 'seconds':
        sql = seconds;
        break;
      case 'minutes':
        sql = `${seconds} / 60`;
        break;
      case 'hours':
        sql = `${seconds} / 3600`;
        break;
      case 'days':
        sql = days;
        break;
      case 'weeks':
        sql = `${days} / 7`;
        break;
      case 'months':
        sql = `${yearDiff} * 12 + ${part('%m', 'nc_fn.a')} - ${part(
          '%m',
          'nc_fn.b',
        )}`;
        break;
      case 'quarters':
        sql = `${yearDiff} * 4 + (${part('%m', 'nc_fn.a')} - 1) / 3 - (${part(
          '%m',
          'nc_fn.b',
        )} - 1) / 3`;
        break;
      case 'years':
        // complete years, as pg's AGE counts them
        sql = `${yearDiff} - (strftime('%m-%d %H:%M:%f', nc_fn.a) < strftime('%m-%d %H:%M:%f', nc_fn.b))`;
        break;
      default:
        NcError.badRequest(`Invalid unit "${rawUnit}" for FROMNOW`);
    }
    return {
      builder: knex.raw(
        `(SELECT ${sql} FROM (SELECT max(nc_fv.n, nc_fv.v) AS a, min(nc_fv.n, nc_fv.v) AS b FROM (SELECT ${nowJd} AS n, julianday(nc_fw.t) AS v FROM (SELECT ? AS t LIMIT -1 OFFSET 0) nc_fw) nc_fv) nc_fn)`,
        [value],
      ),
    };
  },
  DATETIME_FORMAT: async ({ fn, knex, pt }: MapFnArgs) => {
    const format = extractDatetimeFormat(pt);
    const dateExpr = sqliteLocalInstant(
      `(${(await fn(pt?.arguments[0])).builder})`,
      pt?.arguments[0],
    );
    return {
      builder: knex.raw(
        escapePlaceholders(
          getDatetimeFormatHandler(ClientType.SQLITE).build(dateExpr, format),
        ),
      ),
    };
  },
  WORKDAY: workdayFn(sqliteWorkdayDialect),
  WORKDAY_DIFF: workdayDiffFn(sqliteWorkdayDialect),
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // strftime('%w', date) - day of week 0 - 6 with Sunday == 0
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(strftime('%w', ${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - 1 - ${getWeekdayByText(pt?.arguments[1]?.value)} % 7 + 7) % 7`,
      ),
    };
  },
  WEEKNUM: async ({ fn, knex, pt }: MapFnArgs) => {
    // Excel-compatible WEEKNUM: week 1 is the week containing Jan 1, weeks start
    // on Sunday by default. strftime('%w') is 0 (Sunday) .. 6 (Saturday);
    // strftime('%j') is the 1-based day of the year.
    const source =
      pt.arguments[0].type === 'Literal'
        ? `'${dayjs((await fn(pt.arguments[0])).builder).format('YYYY-MM-DD')}'`
        : `(${(await fn(pt.arguments[0])).builder})`;
    const startSun = getWeekStartOffsetSunday(pt?.arguments[1]?.value);
    const doy = `CAST(strftime('%j', ${source}) AS INTEGER)`;
    const dow = `CAST(strftime('%w', ${source}) AS INTEGER)`;
    return {
      builder: knex.raw(
        `CAST((((${doy} - 1) + ((((${dow} - (${doy} - 1) - ${startSun}) % 7) + 7) % 7)) / 7) + 1 AS INTEGER)`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%d', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%m', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CAST(strftime('%Y', (${
          (await fn(pt?.arguments[0])).builder
        })) AS INTEGER)`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapePlaceholders(
        `CAST(strftime('%H', ${await sqliteTimePart(
          fn,
          pt?.arguments[0],
        )}) AS INTEGER)`,
      ),
    ),
  }),
  MINUTE: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapePlaceholders(
        `CAST(strftime('%M', ${await sqliteTimePart(
          fn,
          pt?.arguments[0],
        )}) AS INTEGER)`,
      ),
    ),
  }),
  SECOND: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapePlaceholders(
        `CAST(strftime('%S', ${await sqliteTimePart(
          fn,
          pt?.arguments[0],
        )}) AS INTEGER)`,
      ),
    ),
  }),
  // same clock as NOW() on this dialect
  TODAY: (args: MapFnArgs) => {
    return { builder: args.knex.raw(`DATE('now', 'localtime')`) };
  },
  IS_SAME: isSameFn(sqliteDateCompareDialect),
  IS_AFTER: isAfterFn(sqliteDateCompareDialect),
  IS_BEFORE: isBeforeFn(sqliteDateCompareDialect),
  TEXTBEFORE: textBeforeFn(sqliteTextOccurrenceDialect),
  TEXTAFTER: textAfterFn(sqliteTextOccurrenceDialect),
  SUBSTITUTE: substituteFn(sqliteTextOccurrenceDialect),
  DATETIME_PARSE: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    if (pt.arguments[0].dataType === FormulaDataTypes.DATE) {
      return { builder: value };
    }
    return {
      builder: knex.raw(
        escapePlaceholders(
          getDatetimeParseHandler(ClientType.SQLITE).build(
            `(${value.toQuery()})`,
            pt.arguments[1]?.value,
          ),
        ),
      ),
    };
  },
  AND: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' AND ',
    );

    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await args.fn(ar, '', 'AND')).builder;
        return { builder: argsStr };
      }),
    );

    const clause = args.knex
      .raw(
        predicates,
        parsedArguments.map((a) => a.builder),
      )
      .wrap('(', ')');

    return {
      builder: args.knex.raw(`CASE WHEN ? THEN 1 ELSE 0 END `, [clause]),
    };
  },
  OR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' OR ',
    );

    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await args.fn(ar, '', 'OR')).builder;
        return { builder: argsStr };
      }),
    );

    const clause = args.knex
      .raw(
        predicates,
        parsedArguments.map((a) => a.builder),
      )
      .wrap('(', ')');

    return {
      builder: args.knex.raw(`CASE WHEN ? THEN 1 ELSE 0 END `, [clause]),
    };
  },
  async JSON_EXTRACT(args: MapFnArgs) {
    const source = (await args.fn(args.pt.arguments[0])).builder;

    // When the path is a string literal, prebuild the full jsonpath and bind
    // as a single parameter — avoids leaving `'$' ||` adjacent in the SQL,
    // which gets corrupted by JS String.prototype.replace special patterns
    // (the `$'` and `` $` `` pairs) when knex inlines this raw inside named-
    // binding wrappers like VALUE(). See nocodb/nocodb#12695.
    const pathArg = args.pt.arguments[1];
    if (
      pathArg?.type === JSEPNode.LITERAL &&
      typeof pathArg.value === 'string'
    ) {
      const path = jsonPathFromLiteral(pathArg.value);
      return {
        builder: args.knex.raw(
          `CASE WHEN json_valid(?) = 1 AND ? NOT LIKE '%[-%' THEN json_extract(?, ?) ELSE NULL END`,
          [source, path, source, path],
        ),
      };
    }

    const needle = (await args.fn(pathArg)).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN json_valid(?) = 1 AND ('$' || ltrim(?, '$')) NOT LIKE '%[-%' THEN json_extract(?, '$' || ltrim(?, '$')) ELSE NULL END`,
        [source, needle, source, needle],
      ),
    };
  },
};

export default sqlite3;
