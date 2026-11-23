import dayjs from 'dayjs';
import { customAlphabet } from 'nanoid';
import { ClientType, FormulaDataTypes, JSEPNode, UITypes } from 'nocodb-sdk';
import commonFns, {
  escapePlaceholders,
  extractDatetimeFormat,
  getDatetimeFormatTimezone,
  isDatetimeInstantNode,
  isNumericValueArg,
  jsonPathFromLiteral,
  safeDateAddUnitSQL,
  treatArgAsConditionalExp,
  validateDateAddUnit,
} from './commonFns';
import type { CallExpressionNode, ParsedFormulaNode } from 'nocodb-sdk';
import type { MapFnArgs } from '~/db/mapFunctionName';
import type { WorkdaySqlDialect } from '~/db/functionMappings/workday';
import type { DateCompareSqlDialect } from '~/db/functionMappings/dateCompare';
import type { TextOccurrenceSqlDialect } from '~/db/functionMappings/textOccurrence';
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
import {
  escapeBindingPlaceholders,
  questionFreeLiteral,
  rawFromBuilder,
} from '~/helpers/sqlSanitize';
import {
  guardedLogBaseSql,
  guardedLogSql,
  guardedPowerSql,
  guardedSqrtSql,
  ieeeLogBaseSql,
  ieeeLogSql,
  ieeeModuloSql,
  ieeePowerSql,
  ieeeSqrtSql,
  isFiniteSql,
  isPgIeeeEnabled,
  stripNaNSql,
} from '~/db/formulav2/pg-ieee';
import {
  isBooleanFormulaType,
  pgBooleanAsNumberSql,
} from '~/db/formulav2/formula-query-builder.helpers';
import { convertUnits } from '~/helpers/convertUnits';
import {
  getWeekdayByText,
  getWeekStartOffsetSunday,
} from '~/helpers/formulaFnHelper';
import { NcError } from '~/helpers/ncError';
import {
  getDatetimeFormatHandler,
  getDatetimeParseHandler,
} from '~/db/datetime-format';
import { pgLenientTextInstant } from '~/db/datetime-format/handlers/datetime-parse.pg.handler';
import { sqlString } from '~/db/datetime-format/handlers/datetime-format.general.handler';
import { workdayDiffFn, workdayFn } from '~/db/functionMappings/workday';

// `{Field}` or `{Link}.{Field}`
const isFieldReference = (argument: any) =>
  argument.type === JSEPNode.IDENTIFIER ||
  argument.type === JSEPNode.MEMBER_EXP;

const getArraySourceAttachmentUnnested = async (
  argument: any,
  args: MapFnArgs,
) => {
  const { builder } = await args.fn({
    ...argument,
    fnName: isFieldReference(argument) ? 'CONCAT' : argument.fnName,
  });
  if (!(<CallExpressionNode>argument).inArrayFormat) {
    const sourceQuery = '??::jsonb';
    const unnestedAsTable = [
      `select __elem->>'id' as id, __elem->>'title' as title, __elem::text as __val`,
      `from jsonb_array_elements(${sourceQuery}) as __elem`,
    ].join(' ');

    return { builder: args.knex.raw(`${unnestedAsTable}`, [builder]) };
  } else {
    const sourceQuery = '??';
    const unnestedAsTable = [
      `select __elem->>'id' as id, __elem->>'title' as title, __elem::text as __val`,
      `from unnest(${sourceQuery}) as __elem`,
    ].join(' ');

    return { builder: args.knex.raw(`${unnestedAsTable}`, [builder]) };
  }
};

const getArraySourceUserUnnested = async (argument: any, args: MapFnArgs) => {
  const { builder } = await args.fn({
    ...argument,
    fnName: isFieldReference(argument) ? 'NO_AGG' : argument.fnName,
  });
  let sourceQuery = '??';
  if (!(<CallExpressionNode>argument).inArrayFormat) {
    sourceQuery = `ARRAY(??)`;
  }
  const baseUserCte = await args.knex.cteGenerator().baseUser({});
  const conversionQuery = `UNNEST( STRING_TO_ARRAY( UNNEST( ${sourceQuery} ), ',') )`;
  const unnestedAsTable = [
    `SELECT _tbl.userid, ${baseUserCte.alias}.email`,
    `FROM (SELECT ${conversionQuery} as userid) _tbl`,
    ` LEFT OUTER JOIN ${baseUserCte.alias} on _tbl.userid = ${baseUserCte.alias}.id`,
    `WHERE _tbl.userid IS NOT NULL AND _tbl.userid != ''`,
  ].join(' ');

  return { builder: args.knex.raw(`${unnestedAsTable}`, [builder]) };
};

const getArraySource = async (argument: any, args: MapFnArgs) => {
  return await args.fn({
    ...argument,
    fnName: isFieldReference(argument) ? 'ARRAY_AGG' : argument.fnName,
  });
};

// an entry is a holiday only if it round-trips as a real `YYYY-MM-DD` date;
// the nested CASEs keep make_date from seeing malformed parts
const PG_HOLIDAY_YEAR = `substr(wdt.t, 1, 4)::int`;
const PG_HOLIDAY_MONTH = `substr(wdt.t, 6, 2)::int`;
const PG_HOLIDAY_DATE = `(make_date(${PG_HOLIDAY_YEAR}, ${PG_HOLIDAY_MONTH}, 1) + (substr(wdt.t, 9, 2)::int - 1))`;

const pgWorkdayDialect: WorkdaySqlDialect = {
  dayNumber: (sql) => `((${sql})::date - DATE '1900-01-01')`,
  fromDayNumber: (sql) => `(DATE '1900-01-01' + (${sql})::int)`,
  dateLiteral: (isoDate) => `DATE '${isoDate}'`,
  intDiv: (a, b) => `(${a} / ${b})`,
  mod: (a, b) => `(${a} % ${b})`,
  toInteger: (sql, isNumeric) =>
    isNumeric
      ? `TRUNC((${sql})::numeric)::int`
      : `(substring(btrim((${sql})::text) from '^-{0,1}[0-9]{1,9}'))::int`,
  holidayDays: (sql) =>
    `(SELECT CASE WHEN wdt.t ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN CASE WHEN ${PG_HOLIDAY_YEAR} > 0 AND ${PG_HOLIDAY_MONTH} BETWEEN 1 AND 12 AND substr(wdt.t, 9, 2)::int BETWEEN 1 AND 31 THEN CASE WHEN to_char(${PG_HOLIDAY_DATE}, 'YYYY-MM-DD') = wdt.t THEN ${PG_HOLIDAY_DATE} - DATE '1900-01-01' END END END AS hn FROM (SELECT btrim(wdx, ' ' || chr(9) || chr(10) || chr(13)) AS t FROM unnest(string_to_array((${sql})::text, ',')) AS wdx) wdt)`,
  castResult: (sql) => `(${sql})::int`,
  noInline: ' OFFSET 0',
};

// EPOCH reads a plain timestamp as UTC and a timestamptz as its instant, so
// both resolve to the same instant regardless of the session timezone
// parenthesised: a trailing `::TIMESTAMP` would otherwise cast the zone name
const pgInstantInZone = (sql: string, timezone: string) =>
  `(to_timestamp(EXTRACT(EPOCH FROM (${sql}))) AT TIME ZONE '${timezone.replace(
    /'/g,
    "''",
  )}')`;

// the zone DATETIME_PARSE reads bare text in
const pgTextZone = () => getDatetimeFormatTimezone() ?? 'UTC';

// text as an instant, bare text in DATETIME_PARSE's zone; NULL rather than a
// failed query for a non-date, which `::timestamp` would raise on
const pgTextInstant = (sql: string) => pgLenientTextInstant(sql, pgTextZone());

// wall time in the server zone, the frame DATETIME_FORMAT shows: an instant
// is converted (whatever the session TimeZone), text read there, a Date as is
const pgZoneWall = (sql: string, node?: ParsedFormulaNode) => {
  if (node?.dataType === FormulaDataTypes.STRING)
    return `(${pgTextInstant(sql)} AT TIME ZONE ${sqlString(pgTextZone())})`;
  return isDatetimeInstantNode(node)
    ? pgInstantInZone(sql, pgTextZone())
    : `(${sql})::TIMESTAMP`;
};

const pgDateCompareDialect: DateCompareSqlDialect = {
  truncate: (sql, unit, dataType) => {
    // text as wall time in the zone localInstant reads instants in
    const ts =
      dataType === FormulaDataTypes.STRING
        ? `(${pgTextInstant(sql)} AT TIME ZONE ${sqlString(pgTextZone())})`
        : `(${sql})::timestamp`;
    return unit ? `date_trunc('${unit}', ${ts})` : ts;
  },
  datetimeLiteral: (iso) => `TIMESTAMP '${iso}'`,
  // the zone DATETIME_FORMAT and TODAY() use
  localInstant: (sql) => {
    const timezone = getDatetimeFormatTimezone();
    return timezone ? pgInstantInZone(sql, timezone) : sql;
  },
};

// date and time parts all read the server-zone wall time; a Time field
// (INTERVAL) is a pg `time`, which can't be cast to timestamp
const pgDatePart = async (
  fn: MapFnArgs['fn'],
  node?: ParsedFormulaNode,
): Promise<string> => {
  const sql = `(${(await fn(node)).builder.toQuery()})`;
  if (node?.dataType === FormulaDataTypes.INTERVAL) return `(${sql}::TIME)`;
  return `(${pgZoneWall(sql, node)})`;
};

const pgTextOccurrenceDialect: TextOccurrenceSqlDialect = {
  isWhole: (sql) => `((${sql})::numeric = TRUNC((${sql})::numeric))`,
  // the n-th delimiter ends the n-th element of string_to_array
  occurrence: (text, delim, n) =>
    `(SELECT CASE WHEN _to.i BETWEEN 1 AND _to.k THEN char_length(array_to_string(_to.a[1:_to.i], ${delim})) + 1 ELSE 0 END FROM (SELECT _tk.a, _tk.k, CASE WHEN ${n} > 0 THEN ${n} ELSE _tk.k + ${n} + 1 END AS i FROM (SELECT _ta.a, cardinality(_ta.a) - 1 AS k FROM (SELECT string_to_array((${text})::text, (${delim})::text) AS a OFFSET 0) _ta) _tk) _to)`,
  substr: (text, from, length) =>
    length
      ? `SUBSTR((${text})::text, ${from}, ${length})`
      : `SUBSTR((${text})::text, ${from})`,
  length: (sql) => `char_length((${sql})::text)`,
  concat: (parts) => `(${parts.map((p) => `(${p})::text`).join(' || ')})`,
  noInline: ' OFFSET 0',
};

// pg's substr takes only integer: a Number/Decimal is truncated and clamped to
// int range (as SQLite truncates); a NULL stays NULL (GREATEST would drop it)
const pgSubstrInt = (col: string, min: number) =>
  `CASE WHEN ${col} IS NOT NULL THEN TRUNC(LEAST(GREATEST(${col}, ${min}), 2147483647))::INTEGER END`;

// a negative start counts from the end, and one before the first character
// or a negative length is empty, as on MySQL
const pgSubstr = async ({ fn, knex, pt }: MapFnArgs) => {
  const str = (await fn(pt.arguments[0])).builder;
  const positionFrom = (await fn(pt.arguments[1] ?? 1)).builder;
  const numberOfCharacters = pt.arguments[2]
    ? (await fn(pt.arguments[2])).builder
    : null;
  const p = pgSubstrInt('nc_ss.p', -2147483648);
  const from = `CASE WHEN char_length(nc_ss.t)::bigint + ${p} < 0 THEN 2147483647 WHEN ${p} < 0 THEN char_length(nc_ss.t) + ${p} + 1 ELSE ${p} END`;
  return {
    builder: knex.raw(
      `(SELECT SUBSTR(nc_ss.t, ${from}${
        numberOfCharacters ? `, ${pgSubstrInt('nc_ss.n', 0)}` : ''
      }) FROM (SELECT (?)::TEXT AS t, (?)::numeric AS p, ${
        numberOfCharacters ? '(?)::numeric' : 'NULL::numeric'
      } AS n OFFSET 0) nc_ss)`,
      numberOfCharacters
        ? [str, positionFrom, numberOfCharacters]
        : [str, positionFrom],
    ),
  };
};

const pg = {
  ...commonFns,
  LEN: 'length',
  MIN: 'least',
  // pg's GREATEST ranks NaN above every number, so MAX(NaN, 5) is NaN — IEEE
  // maxNum ignores NaN and returns 5. LEAST needs no guard for the same reason
  // it is already correct: NaN being largest means it never wins a minimum.
  // `greatest` is the same handler under the name older columns stored: when a
  // mapping is a plain string alias, mapFunctionName rewrites pt.callee.name and
  // that rewritten tree is persisted, so a MAX column created before this became
  // a function still arrives as `greatest` and would otherwise skip the guard.
  GREATEST: async (args: MapFnArgs) => pg.MAX(args),
  MAX: async ({ fn, knex, pt }: MapFnArgs) => {
    const args = await Promise.all(
      pt.arguments.map(async (arg) => `(${(await fn(arg)).builder})`),
    );
    const allNumeric = pt.arguments.every(
      (arg) => arg.dataType === FormulaDataTypes.NUMERIC,
    );
    if (!allNumeric || !isPgIeeeEnabled(knex)) {
      return { builder: knex.raw(`greatest(${args.join(', ')})`) };
    }
    // Strip NaN from the operands, then fall back to the unstripped form so an
    // all-NaN argument list still yields NaN instead of blanking.
    const stripped = args.map((arg) => stripNaNSql(arg));
    return {
      builder: knex.raw(
        `COALESCE(greatest(${stripped.join(', ')}), greatest(${args.join(
          ', ',
        )}))`,
      ),
    };
  },
  CEILING: 'ceil',
  // `pow` is the same handler under the name older columns stored: a plain
  // string mapping rewrites pt.callee.name and that tree is persisted, so a
  // POWER column created before this became a function still arrives as `pow`.
  // Same reason GREATEST exists above. SQRT needs no twin — 'sqrt' uppercases
  // back to SQRT, so it keeps hitting its own key.
  POW: async (args: MapFnArgs) => pg.POWER(args),
  POWER: async ({ fn, knex, pt }: MapFnArgs) => {
    const base = (await fn(pt.arguments[0])).builder;
    const exponent = (await fn(pt.arguments[1])).builder;
    if (!isPgIeeeEnabled(knex)) {
      return { builder: knex.raw(guardedPowerSql(`${base}`, `${exponent}`)) };
    }
    return { builder: knex.raw(ieeePowerSql(`${base}`, `${exponent}`)) };
  },
  LOG: async ({ fn, knex, pt }: MapFnArgs) => {
    if (pt.arguments.length > 1) {
      const base = (await fn(pt.arguments[0])).builder;
      const value = (await fn(pt.arguments[1])).builder;
      if (!isPgIeeeEnabled(knex)) {
        return { builder: knex.raw(guardedLogBaseSql(`${base}`, `${value}`)) };
      }
      return { builder: knex.raw(ieeeLogBaseSql(`${base}`, `${value}`)) };
    }
    const source = (await fn(pt.arguments[0])).builder;
    if (!isPgIeeeEnabled(knex)) {
      return { builder: knex.raw(guardedLogSql(`${source}`)) };
    }
    return { builder: knex.raw(ieeeLogSql(`${source}`)) };
  },
  SQRT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    if (!isPgIeeeEnabled(knex)) {
      return { builder: knex.raw(guardedSqrtSql(`${source}`)) };
    }
    return { builder: knex.raw(ieeeSqrtSql(`${source}`)) };
  },
  SEARCH: async (args: MapFnArgs) => {
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    const source = (await args.fn(args.pt.arguments[0])).builder;

    return {
      builder: args.knex.raw(`POSITION(? in ?)`, [needle, source]),
    };
  },
  INT(args: MapFnArgs) {
    // todo: correction
    return {
      builder: args.knex.raw(
        `REGEXP_REPLACE(COALESCE(${args.fn(
          args.pt.arguments[0],
        )}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')`,
      ),
    };
  },
  MID: pgSubstr,
  FLOAT: async ({ fn, knex, pt }: MapFnArgs) => {
    let source = (await fn(pt.arguments[0])).builder;
    if (isBooleanFormulaType(pt.arguments[0]?.dataType)) {
      source = knex.raw(pgBooleanAsNumberSql('?'), [source]);
    }

    return {
      builder: knex.raw(`CAST(? as DOUBLE PRECISION)`, [source]).wrap('(', ')'),
    };
  },
  ROUND: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const precision = pt?.arguments[1]
      ? (await fn(pt.arguments[1])).builder
      : 0;

    if (!isPgIeeeEnabled(knex)) {
      return {
        builder: knex.raw(`ROUND((?)::numeric, ?)`, [source, precision]),
      };
    }
    // ROUND is numeric-only, and casting ±Infinity/NaN to numeric raises on
    // pg < 14. Rounding a non-finite value is the value itself anyway.
    return {
      builder: knex.raw(
        `(CASE WHEN ${isFiniteSql(
          `(?)`,
        )} THEN ROUND((?)::numeric, ?) ELSE (?) END)`,
        [source, source, precision, source],
      ),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const typeCast =
      pt.arguments[0].dataType !== FormulaDataTypes.DATE ? '::DATE' : '';
    const modifier = (await fn(pt.arguments[1])).builder;

    if (pt.arguments[2].type === 'Literal') {
      const scale = validateDateAddUnit(
        String((await fn(pt.arguments[2])).builder),
      );
      return {
        builder: knex
          .raw(
            `(?)${typeCast} + (? ||
      '?')::interval`,
            [source, modifier, knex.raw(scale)],
          )
          .wrap('(', ')'),
      };
    }

    const scaleExpr = safeDateAddUnitSQL(
      knex,
      (await fn(pt.arguments[2])).builder,
    );
    return {
      builder: knex
        .raw(`(?)${typeCast} + (? || ' ' || ?)::interval`, [
          source,
          modifier,
          scaleExpr,
        ])
        .wrap('(', ')'),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
    // two instants subtract in UTC (no DST hour); anything else in server-zone
    // wall time, where Dates and bare text live. A literal's Day.js wall is in
    // the process zone, which is that zone.
    // SQL text: a Raw is thenable, so an async function returning one runs it
    const utc =
      isDatetimeInstantNode(pt.arguments[0]) &&
      isDatetimeInstantNode(pt.arguments[1]);
    const side = async (node: MapFnArgs['pt']): Promise<string> => {
      if (
        node.dataType !== FormulaDataTypes.DATE &&
        node.dataType !== FormulaDataTypes.STRING
      )
        return (await fn(node)).builder.toQuery();
      if (node.type === JSEPNode.LITERAL) {
        const date = parseLiteralDate(String(node.value ?? ''));
        return node.value && date.isValid()
          ? `TIMESTAMP '${date.format('YYYY-MM-DD HH:mm:ss.SSS')}'`
          : 'NULL::TIMESTAMP';
      }
      const sql = `(${(await fn(node)).builder.toQuery()})`;
      return utc ? pgInstantInZone(sql, 'UTC') : `(${pgZoneWall(sql, node)})`;
    };
    const datetime_expr1 = await side(pt.arguments[0]);
    const datetime_expr2 = await side(pt.arguments[1]);
    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    const expr1_typecast =
      pt.arguments[0].dataType === FormulaDataTypes.DATE ? '::TIMESTAMP' : '';
    const expr2_typecast =
      pt.arguments[1].dataType === FormulaDataTypes.DATE ? '::TIMESTAMP' : '';

    let sql;
    const unit = convertUnits(rawUnit, 'pg');
    switch (unit) {
      case 'second':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast}))::INTEGER`;
        break;
      case 'minute':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast}))::INTEGER / 60`;
        break;
      case 'milliseconds':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast}))::INTEGER * 1000`;
        break;
      case 'hour':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast}))::INTEGER / 3600`;
        break;
      case 'week':
        sql = `TRUNC(DATE_PART('day', ${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast}) / 7)`;
        break;
      case 'month':
        sql = `(
                DATE_PART('year', ${datetime_expr1}${expr1_typecast}) -
                DATE_PART('year', ${datetime_expr2}${expr2_typecast})
               ) * 12 + (
                DATE_PART('month', ${datetime_expr1}${expr1_typecast}) -
                DATE_PART('month', ${datetime_expr2}${expr2_typecast})
               )`;
        break;
      case 'quarter':
        sql = `((EXTRACT(QUARTER FROM ${datetime_expr1}${expr1_typecast}) +
                    DATE_PART('year', AGE(${datetime_expr1}, '1900/01/01')) * 4) - 1) -
                ((EXTRACT(QUARTER FROM ${datetime_expr2}${expr2_typecast}) +
                    DATE_PART('year', AGE(${datetime_expr2}, '1900/01/01')) * 4) - 1)`;
        break;
      case 'year':
        sql = `DATE_PART('year', AGE(${datetime_expr1}, ${datetime_expr2}))`;
        break;
      case 'day':
        sql = `DATE_PART('day', ${datetime_expr1}${expr1_typecast} - ${datetime_expr2}${expr2_typecast})`;
        break;
      default:
        sql = '';
    }
    return { builder: knex.raw(escapePlaceholders(`${sql}`)) };
  },
  WORKDAY: workdayFn(pgWorkdayDialect),
  WORKDAY_DIFF: workdayDiffFn(pgWorkdayDialect),
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // isodow: the day of the week as Monday (1) to Sunday (7)
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        escapeBindingPlaceholders(
          `(EXTRACT(ISODOW FROM ${
            pt.arguments[0].type === 'Literal'
              ? `date '${dayjs((await fn(pt.arguments[0])).builder).format(
                  'YYYY-MM-DD',
                )}'`
              : await pgDatePart(fn, pt.arguments[0])
          }) - 1 - ${getWeekdayByText(
            pt?.arguments[1]?.value,
          )} % 7 + 7) ::INTEGER % 7`,
        ),
      ),
    };
  },
  WEEKNUM: async ({ fn, knex, pt }: MapFnArgs) => {
    // Excel-compatible WEEKNUM: week 1 is the week containing Jan 1, weeks start
    // on Sunday by default. DOW is 0 (Sunday) .. 6 (Saturday); DOY is 1-based.
    const source =
      pt.arguments[0].type === 'Literal'
        ? `date '${dayjs((await fn(pt.arguments[0])).builder).format(
            'YYYY-MM-DD',
          )}'`
        : await pgDatePart(fn, pt.arguments[0]);
    const startSun = getWeekStartOffsetSunday(pt?.arguments[1]?.value);
    const doy = `EXTRACT(DOY FROM ${source})::INTEGER`;
    const dow = `EXTRACT(DOW FROM ${source})::INTEGER`;
    return {
      builder: knex.raw(
        escapeBindingPlaceholders(
          `(FLOOR(((${doy} - 1) + ((((${dow} - (${doy} - 1) - ${startSun}) % 7) + 7) % 7)) / 7.0) + 1)::INTEGER`,
        ),
      ),
    };
  },
  DATESTR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `TO_CHAR((${
          (await fn(pt?.arguments[0])).builder
        }), 'YYYY-MM-DD')::text`,
      ),
    };
  },
  DATETIME_FORMAT: async ({ fn, knex, pt }: MapFnArgs) => {
    const format = extractDatetimeFormat(pt);
    let dateExpr = `${(await fn(pt?.arguments[0])).builder}`;
    const timezone = getDatetimeFormatTimezone();
    if (timezone && isDatetimeInstantNode(pt?.arguments[0])) {
      dateExpr = pgInstantInZone(dateExpr, timezone);
    }
    return {
      builder: knex.raw(
        `${escapePlaceholders(
          getDatetimeFormatHandler(ClientType.PG).build(dateExpr, format),
        )}::text`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT('Day' FROM ${await pgDatePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT('Month' FROM ${await pgDatePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT('Year' FROM ${await pgDatePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT('Hour' FROM ${await pgDatePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  MINUTE: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT('Minute' FROM ${await pgDatePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  SECOND: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `FLOOR(EXTRACT('Second' FROM ${await pgDatePart(
          fn,
          pt?.arguments[0],
        )}))`,
      ),
    ),
  }),
  // the date in the same zone DATETIME_FORMAT renders in; NOW() runs per query,
  // so a cached plan stays correct
  TODAY: async ({ knex }: MapFnArgs) => {
    const timezone = (getDatetimeFormatTimezone() ?? 'UTC').replace(/'/g, "''");
    return {
      builder: knex.raw(`((NOW() AT TIME ZONE '${timezone}')::date)`),
    };
  },
  IS_SAME: isSameFn(pgDateCompareDialect),
  IS_AFTER: isAfterFn(pgDateCompareDialect),
  IS_BEFORE: isBeforeFn(pgDateCompareDialect),
  TEXTBEFORE: textBeforeFn(pgTextOccurrenceDialect),
  TEXTAFTER: textAfterFn(pgTextOccurrenceDialect),
  SUBSTITUTE: substituteFn(pgTextOccurrenceDialect),
  DATETIME_PARSE: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    if (pt.arguments[0].dataType === FormulaDataTypes.DATE) {
      return { builder: value };
    }
    return {
      builder: knex.raw(
        escapePlaceholders(
          getDatetimeParseHandler(ClientType.PG).build(
            `${value.toQuery()}`,
            pt.arguments[1]?.value,
            getDatetimeFormatTimezone() ?? 'UTC',
          ),
        ),
      ),
    };
  },
  TEXTSPLIT: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;
    const text = (await fn(pt.arguments[0])).builder.toQuery();
    const delim = (await fn(pt.arguments[1])).builder.toQuery();
    // a NULL delimiter splits into characters on pg; read it as '' (no split)
    const parts = `string_to_array((${text})::text, COALESCE((${delim})::text, ''))`;
    if (!pt.arguments[2]) {
      return { builder: knex.raw(escapePlaceholders(parts)) };
    }
    const ignoreEmpty = (
      await treatArgAsConditionalExp(args, pt.arguments[2])
    ).builder.toQuery();
    return {
      builder: knex.raw(
        escapePlaceholders(
          `(CASE WHEN ${ignoreEmpty} THEN array_remove(${parts}, '') ELSE ${parts} END)`,
        ),
      ),
    };
  },
  ARRAYJOIN: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;
    const separator = pt.arguments[1]
      ? (await fn(pt.arguments[1])).builder
      : knex.raw(`', '`);
    // ARRAYJOIN returns text, so the call node has no referenced column
    const sourceUidt = (<CallExpressionNode>pt.arguments[0])?.referencedColumn
      ?.uidt;
    if (sourceUidt === UITypes.User) {
      const source = (await getArraySourceUserUnnested(pt.arguments[0], args))
        .builder;
      return {
        builder: knex.raw(
          `(SELECT string_agg(email, (?)::text) FROM ( ?? ) as _tbl1)`,
          [separator, source],
        ),
      };
    } else if (sourceUidt === UITypes.Attachment) {
      const source = (
        await getArraySourceAttachmentUnnested(pt.arguments[0], args)
      ).builder;
      return {
        builder: knex.raw(
          `(SELECT string_agg(title, (?)::text) FROM ( ?? ) as _tbl1)`,
          [separator, source],
        ),
      };
    }
    const source = (await getArraySource(pt.arguments[0], args)).builder;
    return {
      builder: knex.raw(`array_to_string(??, (?)::text)`, [source, separator]),
    };
  },
  // concatenates the arrays in argument order; items are read as text so
  // arrays of different element types can be combined. Unless the result keeps
  // a User/Attachment display, users read as emails and attachments as titles
  ARRAYFLATTEN: async (args: MapFnArgs) => {
    const { knex, pt } = args;
    const displayUidt = (<CallExpressionNode>pt).referencedColumn?.uidt;
    const union = (
      await Promise.all(
        pt.arguments.map(async (arg, i) => {
          const argUidt = (<CallExpressionNode>arg).referencedColumn?.uidt;
          if (argUidt === UITypes.User && displayUidt !== UITypes.User) {
            const source = (
              await getArraySourceUserUnnested(arg, args)
            ).builder.toQuery();
            return `SELECT _afu.email AS v, ${i} AS g, row_number() OVER () AS o FROM (${source}) _afu`;
          }
          if (
            argUidt === UITypes.Attachment &&
            displayUidt !== UITypes.Attachment
          ) {
            const source = (
              await getArraySourceAttachmentUnnested(arg, args)
            ).builder.toQuery();
            return `SELECT _afa.title AS v, ${i} AS g, row_number() OVER () AS o FROM (${source}) _afa`;
          }
          const source = (await getArraySource(arg, args)).builder.toQuery();
          return `SELECT _afe.v::text AS v, ${i} AS g, _afe.o FROM unnest((${source})) WITH ORDINALITY AS _afe(v, o)`;
        }),
      )
    ).join(' UNION ALL ');
    return {
      builder: knex.raw(
        escapePlaceholders(
          `ARRAY(SELECT _af.v FROM (${union}) _af ORDER BY _af.g, _af.o)`,
        ),
      ),
    };
  },
  AND: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' AND ',
    );

    // Per-type truthiness, same as the other dialects; a DATE/NUMBER/TEXT
    // operand is not a boolean on pg.
    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await treatArgAsConditionalExp(args, ar)).builder;
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
      builder: args.knex.raw(`CASE WHEN ? THEN TRUE ELSE FALSE END`, [clause]),
    };
  },
  OR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' OR ',
    );

    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        const argsStr = (await treatArgAsConditionalExp(args, ar)).builder;
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
      builder: args.knex.raw(`CASE WHEN ? THEN TRUE ELSE FALSE END`, [clause]),
    };
  },
  SUBSTR: pgSubstr,
  MOD: async ({ fn, knex, pt }: MapFnArgs) => {
    const x = (await fn(pt.arguments[0])).builder;
    const y = (await fn(pt.arguments[1])).builder;
    if (!isPgIeeeEnabled(knex)) {
      return {
        builder: knex.raw(`MOD((${x})::NUMERIC, NULLIF((${y})::NUMERIC, 0))`),
      };
    }
    return { builder: knex.raw(ieeeModuloSql(`${x}`, `${y}`)) };
  },
  REGEX_MATCH: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN REGEXP_MATCH(?::TEXT, ?::TEXT) IS NULL THEN 0 ELSE 1 END`,
        [source, pattern],
      ),
    };
  },
  REGEX_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        // use `SUBSTRING` since REGEXP_MATCH returns array value
        // `REGEXP_MATCH(${source}::TEXT, ${pattern}::TEXT)`,
        `SUBSTRING(??::TEXT from ??::TEXT)`,
        [source, pattern],
      ),
    };
  },
  REGEX_REPLACE: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;

    const replacement = (await fn(pt.arguments[2])).builder;
    return {
      builder: knex.raw(`REGEXP_REPLACE(?::TEXT, ?::TEXT, ?::TEXT, 'g')`, [
        source,
        pattern,
        replacement,
      ]),
    };
  },
  MD5: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`MD5(?::TEXT)`, [source]),
    };
  },
  SHA256: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`ENCODE(SHA256(CONVERT_TO(?::TEXT, 'UTF8')), 'hex')`, [
        source,
      ]),
    };
  },
  SHA512: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`ENCODE(SHA512(CONVERT_TO(?::TEXT, 'UTF8')), 'hex')`, [
        source,
      ]),
    };
  },
  XOR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' # ',
    );
    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (arg) => {
        const cond = (await treatArgAsConditionalExp(args, arg)).builder;
        return {
          builder: args.knex.raw(`CASE WHEN ? THEN 1 ELSE 0 END`, [cond]),
        };
      }),
    );
    // `#` XORs the 0/1 terms into an integer; compare to 1 so the result is a
    // boolean like AND/OR. Left as an integer, boolean filters (checked,
    // notchecked, eq true) failed with `operator does not exist: integer = boolean`.
    return {
      builder: args.knex.raw(
        `((${predicates}) = 1)`,
        parsedArguments.map((a) => a.builder),
      ),
    };
  },
  COUNT: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `${(
          await Promise.all(
            pt.arguments.map(async (arg) => {
              const { builder } = await fn(arg);
              return `CASE WHEN pg_typeof(${builder}) IN ('smallint', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision') AND ${builder} IS NOT NULL THEN 1 ELSE 0 END`;
            }),
          )
        ).join(' + ')}`,
      ),
    };
  },
  COUNTA: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `${(
          await Promise.all(
            pt.arguments.map(async (arg) => {
              const { builder } = await fn(arg);
              return `CASE WHEN ${builder} IS NOT NULL AND ${builder}::text != '' THEN 1 ELSE 0 END`;
            }),
          )
        ).join(' + ')}`,
      ),
    };
  },
  VALUE: async ({ fn, knex, pt, model }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    const kind = await isNumericValueArg(pt.arguments[0], model);
    // Same result as the text path: a float, NULL for Infinity/NaN
    if (kind === 'money') {
      // pg has no money → float8 cast, and money text follows `lc_monetary`.
      // Money is always finite, so it needs no Infinity/NaN guard.
      return { builder: knex.raw(`(:value)::NUMERIC::FLOAT8`, { value }) };
    }
    if (kind) {
      // IEEE arithmetic and stored numeric/float8 values can be Infinity/NaN
      return {
        builder: knex.raw(
          `NULLIF(NULLIF(NULLIF((:value)::FLOAT8, 'Infinity'), '-Infinity'), 'NaN')`,
          { value },
        ),
      };
    }
    // NULL for no digits or more than one dot; a % divides by 100
    return {
      builder: knex.raw(
        `CASE
  WHEN (:value)::TEXT ~ '[.][^.]*[.]' THEN NULL
  ELSE POW(-1, LENGTH(REGEXP_REPLACE((:value)::TEXT, '[^-]', '', 'g'))) * NULLIF(NULLIF(REGEXP_REPLACE((:value)::TEXT, '[^\\d.]+', '', 'g'), ''), '.')::NUMERIC / CASE WHEN STRPOS((:value)::TEXT, '%') > 0 THEN 100 ELSE 1 END
END`,
        {
          value,
        },
      ),
    };
  },
  ROUNDDOWN: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(FLOOR((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder})::numeric(30,${precisionBuilder}))`,
      ),
    };
  },
  ROUNDUP: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(CEIL((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder})::numeric(30,${precisionBuilder}))`,
      ),
    };
  },
  STRING: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`(?)::text`, [source]),
    };
  },
  BOOLEAN: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`(?)::boolean`, [source]),
    };
  },
  JSON_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    const removeNullUnicode = (source: string) => {
      // use four backspace so it will translate into two backspace in sql query
      return `regexp_replace(${source}, '\\\\u0000', 'u0000', 'g')`;
    };
    // When the path argument is a string literal, build the full jsonpath at
    // JS level and bind as a single parameter. The naive `CONCAT('$', ?)`
    // form leaves `'$',` adjacent in the rendered SQL — the `$'` pair is a
    // special pattern in JS's String.prototype.replace ("rest of string after
    // the match"), which knex applies when inlining this raw inside another
    // raw with named bindings (e.g. the `:value` placeholders in VALUE()).
    // The result is corrupted SQL like `CONCAT(', '.price')` and a syntax
    // error. See nocodb/nocodb#12695.
    const pathArg = pt.arguments[1];
    if (
      pathArg?.type === JSEPNode.LITERAL &&
      typeof pathArg.value === 'string'
    ) {
      return {
        builder: knex.raw(
          [
            `CASE WHEN ( ${removeNullUnicode('?')} )::jsonb IS NOT NULL`,
            `THEN jsonb_path_query_first(( ${removeNullUnicode(
              '?',
            )} )::jsonb, (${questionFreeLiteral(
              knex,
              jsonPathFromLiteral(pathArg.value),
            )})::jsonpath)`,
            `ELSE NULL END`,
          ].join(' '),
          [source, source],
        ),
      };
    }

    const needle = (await fn(pathArg)).builder;
    return {
      builder: knex.raw(
        [
          `CASE WHEN ( ${removeNullUnicode('?')} )::jsonb IS NOT NULL`,
          `THEN jsonb_path_query_first(( ${removeNullUnicode(
            '?',
          )} )::jsonb, CONCAT(chr(36), LTRIM(?::text, chr(36)))::jsonpath)`,
          `ELSE NULL END`,
        ].join(' '),
        [source, source, needle],
      ),
    };
  },
  ARRAYSORT: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;

    // Resolve direction eagerly (before getArraySource) to avoid async
    // microtask boundaries that can catch unrelated promise rejections
    // from the source subquery builder.
    let direction: ReturnType<typeof knex.raw>;
    if (!pt.arguments[1]) {
      direction = knex.raw('asc');
    } else if ('value' in pt.arguments[1] && pt.arguments[1].value != null) {
      const normalized = String(pt.arguments[1].value).trim().toLowerCase();
      direction =
        normalized === 'asc' || normalized === 'desc'
          ? knex.raw(normalized)
          : knex.raw('asc');
    } else {
      // Formula expression path (e.g. IF(..., "asc", "desc"))
      direction = rawFromBuilder(knex, (await fn(pt.arguments[1])).builder);
    }

    if ((<CallExpressionNode>pt).referencedColumn?.uidt === UITypes.User) {
      const source = (await getArraySourceUserUnnested(pt.arguments[0], args))
        .builder;
      return {
        builder: knex.raw(
          `ARRAY(SELECT userid FROM ( ?? ORDER BY email ?? ) as _tbl1)`,
          [source, direction],
        ),
      };
    } else if (
      (<CallExpressionNode>pt).referencedColumn?.uidt === UITypes.Attachment
    ) {
      const source = (
        await getArraySourceAttachmentUnnested(pt.arguments[0], args)
      ).builder;
      return {
        builder: knex.raw(
          `ARRAY(SELECT __val::jsonb FROM ( ?? ORDER BY title ?? ) as _tbl1)`,
          [source, direction],
        ),
      };
    }
    const source = (await getArraySource(pt.arguments[0], args)).builder;
    return {
      builder: knex.raw(`ARRAY(SELECT UNNEST(??) ORDER BY 1 ??)`, [
        source,
        direction,
      ]),
    };
  },
  ARRAYUNIQUE: async (args: MapFnArgs) => {
    const { knex, pt } = args;
    if ((<CallExpressionNode>pt).referencedColumn?.uidt === UITypes.User) {
      const source = (await getArraySourceUserUnnested(pt.arguments[0], args))
        .builder;
      return {
        builder: knex.raw(
          `ARRAY(SELECT DISTINCT userid FROM ( ?? ) as _tbl1)`,
          [source],
        ),
      };
    } else if (
      (<CallExpressionNode>pt).referencedColumn?.uidt === UITypes.Attachment
    ) {
      const source = (
        await getArraySourceAttachmentUnnested(pt.arguments[0], args)
      ).builder;
      return {
        builder: knex.raw(
          `ARRAY(SELECT DISTINCT ON(_tbl1.title) __val::jsonb FROM ( ?? ) as _tbl1)`,
          [source],
        ),
      };
    }

    const source = (await getArraySource(pt.arguments[0], args)).builder;
    return {
      builder: knex.raw(`ARRAY(SELECT DISTINCT UNNEST(??))`, [source]),
    };
  },
  ARRAYCOMPACT: async (args: MapFnArgs) => {
    const { knex, pt } = args;
    const source = (await getArraySource(pt.arguments[0], args)).builder;
    const tableName = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    )(6);
    const fieldName = customAlphabet(
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    )(6);
    const selectStatement = [
      `SELECT ${tableName}.${fieldName}`,
      `FROM UNNEST(??) as ${tableName}(${fieldName})`,
      `WHERE ${tableName}.${fieldName} IS NOT NULL AND ${tableName}.${fieldName}::text IS NOT NULL`,
    ].join(' ');
    return {
      builder: knex.raw(`ARRAY(${selectStatement})`, [source]),
    };
  },
  ARRAYSLICE: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;
    const source = (await getArraySource(pt.arguments[0], args)).builder;

    const start = rawFromBuilder(knex, (await fn(pt.arguments[1])).builder);
    const end = pt.arguments[2]
      ? rawFromBuilder(knex, (await fn(pt.arguments[2])).builder)
      : knex.raw('');

    return {
      builder: knex
        .raw(`SELECT (??)[??:??]`, [source, start, end])
        .wrap('(', ')'),
    };
  },

  ARRAYCOUNT: async (args: MapFnArgs) => {
    const { knex, pt } = args;
    const arg = pt.arguments[0];
    if (!arg.isDataArray && arg.dataType !== FormulaDataTypes.ARRAY) {
      return commonFns.ARRAYCOUNT(args);
    }
    // a list of User / Attachment values counts the users / files in it
    const sourceUidt = (<CallExpressionNode>arg).referencedColumn?.uidt;
    if (sourceUidt === UITypes.User || sourceUidt === UITypes.Attachment) {
      const source = (
        sourceUidt === UITypes.User
          ? await getArraySourceUserUnnested(arg, args)
          : await getArraySourceAttachmentUnnested(arg, args)
      ).builder;
      return {
        builder: knex.raw(`(SELECT COUNT(*)::int FROM ( ?? ) as _tbl1)`, [
          source,
        ]),
      };
    }
    const source = (await getArraySource(arg, args)).builder;
    return {
      builder: knex.raw(`COALESCE(cardinality(??), 0)`, [source]),
    };
  },

  LAST_MODIFIED_TIME: async (args: MapFnArgs) => {
    const { pt, knex } = args;

    if (pt.arguments.length !== 0) {
      // extract meta column
      const rowMetaColumn = args.model?.columns?.find(
        (col) => col.uidt === UITypes.Meta,
      );

      if (!rowMetaColumn) {
        NcError.badRequest(
          'This table does not support last modified time with arguments',
        );
      }

      // resolve the meta column through the identifier path so the
      // reference is qualified with the table alias/name — an unqualified
      // nc_row_meta is ambiguous in joined contexts (e.g. lookups), since
      // every EE+PG table has one
      const rowMetaRef = (
        await args.fn({ type: 'Identifier', name: rowMetaColumn.id })
      ).builder;

      // extract columns by params
      const columnQueries = pt.arguments
        .map((arg) => {
          const column = args.model?.columns?.find(
            (col) => col.id === arg.name,
          );

          if (!column) return;

          return knex.raw(
            `(COALESCE((??)::jsonb-> ?,'{}'::jsonb)->>'modifiedTime')::timestamp`,
            [rowMetaRef, column?.id],
          );
        })
        .filter(Boolean);

      return {
        builder: args.knex.raw(`greatest(${columnQueries})`),
      };
    }

    const createdAtCol = args.model?.columns?.find(
      (col) => col.column_name === 'updated_at',
    );
    if (!createdAtCol) {
      NcError.badRequest('Updated at field not found');
    }

    return {
      builder: args.knex.raw(
        `${
          (await args.fn({ type: 'Identifier', name: createdAtCol.id })).builder
        }`,
      ),
    };
  },
};

export default pg;
