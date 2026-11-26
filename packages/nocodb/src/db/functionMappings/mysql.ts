import dayjs from 'dayjs';
import { ClientType, FormulaDataTypes, JSEPNode, UITypes } from 'nocodb-sdk';
import commonFns, {
  ALLOWED_DATEADD_UNITS,
  escapePlaceholders,
  extractDatetimeFormat,
  isNumericValueArg,
  jsonPathFromLiteral,
  validateDateAddUnit,
} from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import type { WorkdaySqlDialect } from '~/db/functionMappings/workday';
import type { DateCompareSqlDialect } from '~/db/functionMappings/dateCompare';
import type { TextOccurrenceSqlDialect } from '~/db/functionMappings/textOccurrence';
import { convertUnits } from '~/helpers/convertUnits';
import { escapeBindingPlaceholders } from '~/helpers/sqlSanitize';
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
} from '~/db/functionMappings/dateCompare';
import {
  substituteFn,
  textAfterFn,
  textBeforeFn,
} from '~/db/functionMappings/textOccurrence';

const mysqlWorkdayDialect: WorkdaySqlDialect = {
  dayNumber: (sql) => `DATEDIFF(${sql}, '1900-01-01')`,
  fromDayNumber: (sql) => `DATE_ADD(DATE '1900-01-01', INTERVAL (${sql}) DAY)`,
  dateLiteral: (isoDate) => `DATE '${isoDate}'`,
  intDiv: (a, b) => `(${a} DIV ${b})`,
  mod: (a, b) => `MOD(${a}, ${b})`,
  // TRUNCATE reads a text value's leading number
  toInteger: (sql) => `CAST(TRUNCATE(${sql}, 0) AS SIGNED)`,
  // Splits via JSON_TABLE. Any character a valid entry can't hold becomes `x`,
  // so the built JSON array is always valid and such an entry is ignored.
  holidayDays: (sql) =>
    `(SELECT CASE WHEN wdt.t REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND DATE_FORMAT(STR_TO_DATE(wdt.t, '%Y-%m-%d'), '%Y-%m-%d') = wdt.t THEN DATEDIFF(STR_TO_DATE(wdt.t, '%Y-%m-%d'), '1900-01-01') END AS hn FROM (SELECT TRIM(wdj.t) AS t FROM JSON_TABLE(CONCAT('["', REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(CAST(${sql} AS CHAR), '[[:space:]]', ' '), '[^0-9, -]', 'x'), ',', '","'), '"]'), '$[*]' COLUMNS (t VARCHAR(255) PATH '$')) wdj) wdt)`,
};

// zero-padded text sorts in time order
const MYSQL_TRUNCATE_FORMATS: Record<string, string> = {
  year: '%Y',
  month: '%Y-%m',
  day: '%Y-%m-%d',
  hour: '%Y-%m-%d %H',
  minute: '%Y-%m-%d %H:%i',
  second: '%Y-%m-%d %H:%i:%s',
};

const mysqlDateCompareDialect: DateCompareSqlDialect = {
  truncate: (sql, unit) =>
    !unit
      ? `CAST(${sql} AS DATETIME(6))`
      : unit === 'week'
      ? `DATE_SUB(DATE(${sql}), INTERVAL WEEKDAY(${sql}) DAY)`
      : `DATE_FORMAT(${sql}, '${MYSQL_TRUNCATE_FORMATS[unit]}')`,
  datetimeLiteral: (iso) => `TIMESTAMP '${iso}'`,
};

// delimiters before the n-th one = SUBSTRING_INDEX up to it
const mysqlDelimCount = (text: string, delim: string) =>
  `((CHAR_LENGTH(${text}) - CHAR_LENGTH(REPLACE(${text}, ${delim}, ''))) DIV CHAR_LENGTH(${delim}))`;
// EXTRACT misreads ISO text ('…T10:30' is hour 0); text is parsed as
// DATETIME_PARSE reads it, NULL when it isn't a date
const mysqlTimePart = async (
  fn: MapFnArgs['fn'],
  node: MapFnArgs['pt'],
  nonTextSuffix = '',
): Promise<string> => {
  const sql = `(${(await fn(node)).builder.toQuery()})`;
  return node?.dataType === FormulaDataTypes.STRING
    ? `(${getDatetimeParseHandler(ClientType.MYSQL).build(sql)})`
    : `(${sql}${nonTextSuffix})`;
};

// MySQL rounds a fractional position or length; truncate it, as the other
// dialects do
const mysqlSubstr = async ({ fn, knex, pt }: MapFnArgs) => {
  const args = [
    (await fn(pt.arguments[0])).builder,
    (await fn(pt.arguments[1] ?? 1)).builder,
  ];
  if (pt.arguments[2]) args.push((await fn(pt.arguments[2])).builder);
  return {
    builder: knex.raw(
      args.length === 3
        ? 'SUBSTRING(?, TRUNCATE(?, 0), TRUNCATE(?, 0))'
        : 'SUBSTRING(?, TRUNCATE(?, 0))',
      args,
    ),
  };
};

const mysqlTextOccurrenceDialect: TextOccurrenceSqlDialect = {
  isWhole: (sql) => `(${sql} = TRUNCATE(${sql}, 0))`,
  occurrence: (text, delim, n, literalN) => {
    // the args are inlined, so the usual literal n > 0 skips the count: the
    // n-th delimiter exists when the text before it is shorter than the text
    if (literalN > 0) {
      const before = `CHAR_LENGTH(SUBSTRING_INDEX(${text}, ${delim}, ${literalN}))`;
      return `(CASE WHEN ${before} < CHAR_LENGTH(${text}) THEN ${before} + 1 ELSE 0 END)`;
    }
    const k = mysqlDelimCount(text, delim);
    const i = `(CASE WHEN ${n} > 0 THEN ${n} ELSE ${k} + ${n} + 1 END)`;
    return `(CASE WHEN ${i} BETWEEN 1 AND ${k} THEN CHAR_LENGTH(SUBSTRING_INDEX(${text}, ${delim}, ${i})) + 1 ELSE 0 END)`;
  },
  substr: (text, from, length) =>
    length
      ? `SUBSTRING(${text}, ${from}, ${length})`
      : `SUBSTRING(${text}, ${from})`,
  length: (sql) => `CHAR_LENGTH(${sql})`,
  concat: (parts) => `CONCAT(${parts.join(', ')})`,
  inlineArgs: true,
};

// LEAST / GREATEST take two or more arguments; MIN(x) is x
const leastGreatestFn =
  (name: 'LEAST' | 'GREATEST') =>
  async ({ fn, knex, pt }: MapFnArgs) => {
    if (pt.arguments?.length === 1) {
      return {
        builder: knex.raw(`(${(await fn(pt.arguments[0])).builder})`),
      };
    }
    pt.callee.name = name;
  };

// MariaDB's REGEXP_SUBSTR/REGEXP_REPLACE take no position/occurrence/match-type
// args, so case sensitivity comes from the inline `(?-i)` flag (MySQL ICU and
// MariaDB PCRE both accept it) instead of the 'c' match type.
// A literal containing `?` is a `_utf8mb4 X'…'` literal whose collation differs
// from the connection's, so CONCAT with '(?-i)' would yield an unusable mixed
// collation; the flag is folded into that literal instead.
async function caseSensitivePattern({ fn, knex, pt }: MapFnArgs) {
  const arg = pt.arguments[1];
  if (
    arg?.type === 'Literal' &&
    typeof arg.value === 'string' &&
    arg.value.includes('?')
  ) {
    return fn({ ...arg, value: `(?-i)${arg.value}` });
  }
  const pattern = (await fn(arg)).builder;
  // `\\?` keeps knex from reading the flag's `?` as a binding.
  return { builder: knex.raw(`CONCAT('(\\?-i)', ?)`, [pattern]) };
}

const mysql2 = {
  ...commonFns,
  // as pg: COUNT counts number-typed arguments, COUNTA non-blank ones; mysql
  // has no runtime type check, so COUNT goes by the argument's formula type
  COUNT: async ({ fn, knex, pt }: MapFnArgs) => {
    // built outside the async callback: a returned raw is thenable, so
    // awaiting it would run it as a query
    const builders = await Promise.all(pt.arguments.map((arg) => fn(arg)));
    const parts = pt.arguments.map((arg, i) => {
      const { builder } = builders[i];
      // a checkbox is a tinyint here but a boolean on pg, which isn't counted
      if (arg.referencedColumn?.uidt === UITypes.Checkbox) {
        return knex.raw('0');
      }
      if (arg.dataType === FormulaDataTypes.NUMERIC) {
        return knex.raw(`CASE WHEN ? IS NOT NULL THEN 1 ELSE 0 END`, [builder]);
      }
      if (arg.dataType && arg.dataType !== FormulaDataTypes.UNKNOWN) {
        return knex.raw('0');
      }
      // the pattern is bound: knex would read its `?` as placeholders
      return knex.raw(`CASE WHEN CAST(? AS CHAR) REGEXP ? THEN 1 ELSE 0 END`, [
        builder,
        '^[-+]?[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?$',
      ]);
    });
    return { builder: knex.raw(parts.map(() => '?').join(' + '), parts) };
  },
  COUNTA: async ({ fn, knex, pt }: MapFnArgs) => {
    const parts = (await Promise.all(pt.arguments.map((arg) => fn(arg)))).map(
      ({ builder }) =>
        knex.raw(
          // not `<> ''`: PAD SPACE collations read '   ' as equal to ''
          `CASE WHEN ? IS NOT NULL AND LENGTH(CAST(? AS CHAR)) > 0 THEN 1 ELSE 0 END`,
          [builder, builder],
        ),
    );
    return { builder: knex.raw(parts.map(() => '?').join(' + '), parts) };
  },
  LEN: 'CHAR_LENGTH',
  MIN: leastGreatestFn('LEAST'),
  MAX: leastGreatestFn('GREATEST'),
  // the names older columns stored: the former string mappings were persisted
  LEAST: leastGreatestFn('LEAST'),
  GREATEST: leastGreatestFn('GREATEST'),
  SEARCH: async (args: MapFnArgs) => {
    args.pt.callee.name = 'LOCATE';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CAST(${(await args.fn(args.pt.arguments[0])).builder} as SIGNED)`,
      ),
    };
  },
  LEFT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,1,?)`, [source, needle]),
    };
  },
  RIGHT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?, -(?))`, [source, needle]),
    };
  },
  MID: async (args: MapFnArgs) => mysqlSubstr(args),
  SUBSTR: async (args: MapFnArgs) => mysqlSubstr(args),
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(
          `CAST(CAST(${
            (await args.fn(args.pt.arguments[0])).builder
          } as CHAR) AS DOUBLE)`,
        )
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const date = (await fn(pt.arguments[0])).builder;
    const count = (await fn(pt.arguments[1])).builder;

    if (pt.arguments[2].type === 'Literal') {
      const unit = validateDateAddUnit(
        String((await fn(pt.arguments[2])).builder),
      );
      return {
        builder: knex.raw(
          `CASE
      WHEN ? LIKE '%:%' THEN
        DATE_FORMAT(DATE_ADD(?, INTERVAL ? ${unit}), '%Y-%m-%d %H:%i:%s')
      ELSE
        DATE(DATE_ADD(?, INTERVAL ? ${unit}))
      END`,
          [date, date, count, date, count],
        ),
      };
    }

    // Dynamic unit (field reference) — MySQL requires keyword units,
    // so branch per valid unit to prevent injection.
    // All dynamic values passed via ? bindings, not interpolated.
    const unitExpr = (await fn(pt.arguments[2])).builder;
    const units = [...ALLOWED_DATEADD_UNITS];
    const branches = units
      .map(
        (u) =>
          `WHEN LOWER(?) = '${u}' THEN
        CASE WHEN ? LIKE '%:%' THEN
          DATE_FORMAT(DATE_ADD(?, INTERVAL ? ${u.toUpperCase()}), '%Y-%m-%d %H:%i:%s')
        ELSE
          DATE(DATE_ADD(?, INTERVAL ? ${u.toUpperCase()}))
        END`,
      )
      .join('\n');
    return {
      builder: knex.raw(
        `CASE ${branches} ELSE NULL END`,
        units.flatMap(() => [unitExpr, date, date, count, date, count]),
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
    const datetime_expr1 = (await fn(pt.arguments[0])).builder;
    const datetime_expr2 = (await fn(pt.arguments[1])).builder;

    const unit = convertUnits(
      pt.arguments[2]
        ? (await fn(pt.arguments[2])).builder.bindings[0]
        : 'seconds',
      'mysql',
    );

    if (unit === 'MICROSECOND') {
      // MySQL doesn't support millisecond
      // hence change from MICROSECOND to millisecond manually
      return {
        builder: knex.raw(
          `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) div 1000`,
        ),
      };
    }
    return {
      builder: knex.raw(
        `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1})`,
      ),
    };
  },
  DATETIME_FORMAT: async ({ fn, knex, pt }: MapFnArgs) => {
    const format = extractDatetimeFormat(pt);
    const dateExpr = (await fn(pt?.arguments[0])).builder;
    return {
      builder: knex.raw(
        escapePlaceholders(
          getDatetimeFormatHandler(ClientType.MYSQL).build(
            `${dateExpr}`,
            format,
          ),
        ),
      ),
    };
  },
  WORKDAY: workdayFn(mysqlWorkdayDialect),
  WORKDAY_DIFF: workdayDiffFn(mysqlWorkdayDialect),
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(WEEKDAY(${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - ${getWeekdayByText(pt?.arguments[1]?.value)} % 7 + 7) % 7`,
      ),
    };
  },
  WEEKNUM: async ({ fn, knex, pt }: MapFnArgs) => {
    // Excel-compatible WEEKNUM: week 1 is the week containing Jan 1, weeks start
    // on Sunday by default. DAYOFWEEK() is 1 (Sunday) .. 7 (Saturday).
    const source =
      pt.arguments[0].type === 'Literal'
        ? `'${dayjs((await fn(pt.arguments[0])).builder).format('YYYY-MM-DD')}'`
        : `(${(await fn(pt.arguments[0])).builder})`;
    const startSun = getWeekStartOffsetSunday(pt?.arguments[1]?.value);
    const doy = `DAYOFYEAR(${source})`;
    const dow = `(DAYOFWEEK(${source}) - 1)`;
    return {
      builder: knex.raw(
        `(FLOOR(((${doy} - 1) + ((((${dow} - (${doy} - 1) - ${startSun}) % 7) + 7) % 7)) / 7) + 1)`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(DAY FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(MONTH FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(YEAR FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => ({
    // `x + 0` keeps a Time field's hour; text is parsed (below)
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT(HOUR FROM ${await mysqlTimePart(
          fn,
          pt?.arguments[0],
          ' + 0',
        )})`,
      ),
    ),
  }),
  MINUTE: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT(MINUTE FROM ${await mysqlTimePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  SECOND: async ({ fn, knex, pt }: MapFnArgs) => ({
    builder: knex.raw(
      escapeBindingPlaceholders(
        `EXTRACT(SECOND FROM ${await mysqlTimePart(fn, pt?.arguments[0])})`,
      ),
    ),
  }),
  // same clock as NOW() on this dialect
  TODAY: async ({ knex }: MapFnArgs) => {
    return { builder: knex.raw(`CURDATE()`) };
  },
  IS_SAME: isSameFn(mysqlDateCompareDialect),
  IS_AFTER: isAfterFn(mysqlDateCompareDialect),
  IS_BEFORE: isBeforeFn(mysqlDateCompareDialect),
  TEXTBEFORE: textBeforeFn(mysqlTextOccurrenceDialect),
  TEXTAFTER: textAfterFn(mysqlTextOccurrenceDialect),
  SUBSTITUTE: substituteFn(mysqlTextOccurrenceDialect),
  DATETIME_PARSE: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    if (pt.arguments[0].dataType === FormulaDataTypes.DATE) {
      return { builder: value };
    }
    return {
      builder: knex.raw(
        escapePlaceholders(
          getDatetimeParseHandler(ClientType.MYSQL).build(
            `(${value.toQuery()})`,
            pt.arguments[1]?.value,
          ),
        ),
      ),
    };
  },
  REGEX_MATCH: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(`(? REGEXP ?)`, [source, pattern]),
    };
  },
  REGEX_EXTRACT: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await caseSensitivePattern(args)).builder;
    return {
      builder: knex.raw(`REGEXP_SUBSTR(?, ?)`, [source, pattern]),
    };
  },
  REGEX_REPLACE: async (args: MapFnArgs) => {
    const { fn, knex, pt } = args;
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await caseSensitivePattern(args)).builder;
    const replacement = (await fn(pt.arguments[2])).builder;
    return {
      builder: knex.raw(`REGEXP_REPLACE(?, ?, ?)`, [
        source,
        pattern,
        replacement,
      ]),
    };
  },
  MD5: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`MD5(?)`, [source]),
    };
  },
  SHA256: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`SHA2(?, 256)`, [source]),
    };
  },
  SHA512: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(`SHA2(?, 512)`, [source]),
    };
  },
  XOR: async ({ fn, knex, pt }: MapFnArgs) => {
    const args = await Promise.all(
      pt.arguments.map(async (arg) => {
        return { builder: (await fn(arg)).builder };
      }),
    );
    const predicates = args.map(() => '?').join(' XOR ');
    return {
      builder: knex.raw(
        `${predicates}`,
        args.map((a) => a.builder),
      ),
    };
  },

  VALUE: async ({ fn, knex, pt, model }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    // a double, as on pg: VALUE(12.6) is 12.6, not 13
    if (await isNumericValueArg(pt.arguments[0], model)) {
      return { builder: knex.raw(`((:value) * 1e0)`, { value }) };
    }

    // NULL for no digits or more than one dot; a % divides by 100.
    // No NULLIF: MySQL evaluates its first argument twice.
    return {
      builder: knex.raw(
        `(CASE
  WHEN :value REGEXP '[.][^.]*[.]' OR :value NOT REGEXP '[0-9]' THEN NULL
  ELSE POW(-1, LENGTH(REGEXP_REPLACE(:value, '[^-]', ''))) * REGEXP_REPLACE(:value, '[^0-9.]+', '') / IF(LOCATE('%', :value) > 0, 100, 1)
END)`,
        { value },
      ),
    };
  },
  STRING: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`CAST(? AS CHAR) `, [source]),
    };
  },
  JSON_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    // When the path is a string literal we prebuild the full jsonpath and
    // bind it once — the naive `CONCAT('$', ?)` rendering leaves `'$',`
    // adjacent in the resulting SQL, and the `$'` pair is interpreted by
    // JS's String.prototype.replace as "rest of string after match" when
    // knex inlines this raw under named-binding wrappers like VALUE().
    // See nocodb/nocodb#12695.
    const pathArg = pt.arguments[1];
    if (
      pathArg?.type === JSEPNode.LITERAL &&
      typeof pathArg.value === 'string'
    ) {
      // mysql rejects a negative array index as an invalid path; pg reads NULL
      if (/\[\s*-\d+\s*\]/.test(pathArg.value)) {
        return { builder: knex.raw('NULL') };
      }
      return {
        builder: knex.raw(
          `CASE WHEN JSON_VALID(?) = 1 THEN JSON_EXTRACT(?, ?) ELSE NULL END`,
          [source, source, jsonPathFromLiteral(pathArg.value)],
        ),
      };
    }

    const needle = (await fn(pathArg)).builder;
    return {
      builder: knex.raw(
        `CASE WHEN JSON_VALID(?) = 1 THEN JSON_EXTRACT(?, CONCAT('$', TRIM(LEADING '$' FROM ?))) ELSE NULL END`,
        [source, source, needle],
      ),
    };
  },
};

export default mysql2;
