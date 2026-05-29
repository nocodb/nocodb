import dayjs from 'dayjs';
import { JSEPNode } from 'nocodb-sdk';
import commonFns, {
  ALLOWED_DATEADD_UNITS,
  validateDateAddUnit,
} from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import { convertUnits } from '~/helpers/convertUnits';
import { getWeekdayByText } from '~/helpers/formulaFnHelper';
import { getDbMajor } from '~/db/util/dbVersion';

// SQL Server major-version thresholds: 16 = SQL Server 2022 (LEAST/GREATEST),
// 14 = SQL Server 2017 (TRIM).
const MSSQL_2017 = 14;
const MSSQL_2022 = 16;

// SQL Server (T-SQL) formula function mappings. Spreads commonFns and
// overrides only what diverges from standard SQL. Functions SQL Server can't
// support (REGEX_*, ARRAY*, VALUE) are blocked upstream in
// MssqlUi.getUnsupportedFnList().

// T-SQL SUBSTRING requires 3 args; default the length to max int when the
// formula caller omits it (NocoDB makes it optional).
const substringFn = async ({ fn, knex, pt }: MapFnArgs) => {
  const str = (await fn(pt.arguments[0])).builder;
  const pos = (await fn(pt.arguments[1])).builder;
  const len = pt.arguments[2]
    ? (await fn(pt.arguments[2])).builder
    : knex.raw('2147483647');
  return { builder: knex.raw(`SUBSTRING(?, ?, ?)`, [str, pos, len]) };
};

// Variadic MIN/MAX. Use scalar LEAST/GREATEST on SQL 2022+; on older versions
// fall back to `(SELECT agg(v) FROM (VALUES …) t(v))` — supported on 2008+
// and matches LEAST/GREATEST's NULL-skipping semantics.
const leastGreatestFn =
  (kind: 'LEAST' | 'GREATEST') =>
  async ({ fn, knex, pt }: MapFnArgs) => {
    const argBuilders = await Promise.all(
      pt.arguments.map(async (a) => (await fn(a)).builder),
    );
    if (argBuilders.length === 1) {
      return { builder: knex.raw('?', [argBuilders[0]]) };
    }

    if (getDbMajor(knex) >= MSSQL_2022) {
      const placeholders = argBuilders.map(() => '?').join(', ');
      return {
        builder: knex.raw(`${kind}(${placeholders})`, argBuilders),
      };
    }

    const rows = argBuilders.map(() => '(?)').join(', ');
    const agg = kind === 'LEAST' ? 'MIN' : 'MAX';
    return {
      builder: knex.raw(
        `(SELECT ${agg}(v) FROM (VALUES ${rows}) AS nc_lg(v))`,
        argBuilders,
      ),
    };
  };

const mssql = {
  ...commonFns,

  // --- renames (NocoDB name -> T-SQL name) ---
  REPEAT: 'REPLICATE',

  MIN: leastGreatestFn('LEAST'),
  MAX: leastGreatestFn('GREATEST'),

  // NocoDB formula spec is `LOG([base], value)` (matches pg/mysql/sqlite);
  // T-SQL's signature is reversed: `LOG(float, base)`. Swap the args so
  // `LOG(2, 1024)` returns 10 on mssql like every other dialect.
  // Single-arg LOG = natural log (base e) — identical signature on both.
  LOG: async ({ fn, knex, pt }: MapFnArgs) => {
    if (pt.arguments.length >= 2) {
      const base = (await fn(pt.arguments[0])).builder;
      const value = (await fn(pt.arguments[1])).builder;
      return { builder: knex.raw(`LOG(?, ?)`, [value, base]) };
    }
    const value = (await fn(pt.arguments[0])).builder;
    return { builder: knex.raw(`LOG(?)`, [value]) };
  },

  // Scalar TRIM was added in SQL Server 2017; fall back to LTRIM(RTRIM(...))
  // on older versions (identical behavior for the default whitespace charset).
  TRIM: async ({ fn, knex, pt }: MapFnArgs) => {
    const arg = (await fn(pt.arguments[0])).builder;
    return {
      builder:
        getDbMajor(knex) >= MSSQL_2017
          ? knex.raw(`TRIM(?)`, [arg])
          : knex.raw(`LTRIM(RTRIM(?))`, [arg]),
    };
  },

  // --- string position/substring ---
  MID: substringFn,
  SUBSTR: substringFn,

  // --- commonFns overrides: T-SQL has CEILING, not CEIL ---
  EVEN: async (args: MapFnArgs) => {
    const query = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN :query >= 0 THEN CEILING((:query) / 2.0) * 2 \n ELSE FLOOR((:query + 2) / 2.0) * 2 - 2\n END`,
        { query },
      ),
    };
  },
  ODD: async (args: MapFnArgs) => {
    const query = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN :query >= 0 THEN CEILING((:query - 1) / 2.0) * 2 + 1 \n ELSE FLOOR((:query + 1) / 2.0) * 2 - 1\n END`,
        { query },
      ),
    };
  },
  ROUND: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const precision = pt?.arguments[1]
      ? (await fn(pt.arguments[1])).builder
      : 0;
    return {
      builder: knex.raw(`ROUND((?), ?)`, [source, precision]),
    };
  },
  ROUNDUP: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      precisionBuilder = (await fn(pt.arguments[1])).builder;
    }
    return {
      builder: knex.raw(
        `(CEILING((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))`,
      ),
    };
  },

  // --- string ---
  SEARCH: async (args: MapFnArgs) => {
    // NocoDB SEARCH(str, searchStr) -> T-SQL CHARINDEX(searchStr, str)
    const str = (await args.fn(args.pt.arguments[0])).builder;
    const searchStr = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`CHARINDEX(?, ?)`, [searchStr, str]),
    };
  },
  STRING: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`CAST(? AS NVARCHAR(MAX))`, [source]),
    };
  },

  // --- numeric / cast ---
  INT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`CAST(? AS INT)`, [source]),
    };
  },
  FLOAT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`CAST(? AS FLOAT)`, [source]).wrap('(', ')'),
    };
  },
  MOD: async ({ fn, knex, pt }: MapFnArgs) => {
    const dividend = (await fn(pt.arguments[0])).builder;
    const divisor = (await fn(pt.arguments[1])).builder;
    // T-SQL has no MOD() function; use the modulo operator.
    return {
      builder: knex.raw(`(? % ?)`, [dividend, divisor]),
    };
  },

  // --- date / time ---
  NOW: async ({ knex }: MapFnArgs) => {
    return { builder: knex.raw(`GETDATE()`) };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => {
    // T-SQL has no HOUR() scalar function.
    return {
      builder: knex.raw(`DATEPART(HOUR, ?)`, [
        (await fn(pt.arguments[0])).builder,
      ]),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const date = (await fn(pt.arguments[0])).builder;
    const count = (await fn(pt.arguments[1])).builder;

    // T-SQL: DATEADD(datepart, number, date). The NocoDB unit keywords
    // (day/week/month/year/hour/minute/second) are valid T-SQL dateparts.
    if (pt.arguments[2].type === 'Literal') {
      const unit = validateDateAddUnit(
        String((await fn(pt.arguments[2])).builder),
      );
      return {
        builder: knex.raw(`DATEADD(${unit}, ?, ?)`, [count, date]),
      };
    }

    // Dynamic unit (field reference): the datepart must be a keyword, so branch
    // per allowed unit. The unit value is only compared via bindings, not
    // interpolated, to prevent injection.
    const unitExpr = (await fn(pt.arguments[2])).builder;
    const units = [...ALLOWED_DATEADD_UNITS];
    const branches = units
      .map((u) => `WHEN LOWER(?) = '${u}' THEN DATEADD(${u}, ?, ?)`)
      .join('\n');
    return {
      builder: knex.raw(
        `CASE ${branches} ELSE NULL END`,
        units.flatMap(() => [unitExpr, count, date]),
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
      'mssql',
    );

    // DATEDIFF(datepart, startdate, enddate) = enddate - startdate, so pass
    // expr2 then expr1 to match (expr1 - expr2), as the other dialects do.
    return {
      builder: knex.raw(`DATEDIFF(${unit}, ?, ?)`, [
        datetime_expr2,
        datetime_expr1,
      ]),
    };
  },
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // 0..6 for Monday..Sunday, independent of @@DATEFIRST:
    //   (DATEPART(weekday, d) + @@DATEFIRST + 5) % 7
    // then shift by the requested start-of-week offset, matching other dialects.
    const dateArg =
      pt.arguments[0].type === 'Literal'
        ? `'${dayjs((await fn(pt.arguments[0])).builder).format('YYYY-MM-DD')}'`
        : (await fn(pt.arguments[0])).builder;
    const offset = getWeekdayByText(pt?.arguments[1]?.value);
    return {
      builder: knex.raw(
        `(((DATEPART(weekday, ${dateArg}) + @@DATEFIRST + 5) % 7) - ${offset} % 7 + 7) % 7`,
      ),
    };
  },

  DATESTR: async ({ fn, knex, pt }: MapFnArgs) => {
    // ISO yyyy-MM-dd via CONVERT style 23.
    return {
      builder: knex.raw(`CONVERT(NVARCHAR(10), ?, 23)`, [
        (await fn(pt?.arguments[0])).builder,
      ]),
    };
  },

  // --- count helpers ---
  COUNT: async ({ fn, knex, pt }: MapFnArgs) => {
    // Count arguments that hold a numeric value. SQL Server has no pg_typeof,
    // so use TRY_CONVERT as a numeric-value test (counts numeric-valued args).
    const parts = await Promise.all(
      pt.arguments.map(async (arg) => {
        const { builder } = await fn(arg);
        return knex.raw(
          `CASE WHEN TRY_CONVERT(FLOAT, ?) IS NOT NULL THEN 1 ELSE 0 END`,
          [builder],
        );
      }),
    );
    return {
      builder: knex.raw(parts.map(() => '?').join(' + '), parts),
    };
  },
  COUNTA: async ({ fn, knex, pt }: MapFnArgs) => {
    const parts = await Promise.all(
      pt.arguments.map(async (arg) => {
        const { builder } = await fn(arg);
        return knex.raw(
          `CASE WHEN ? IS NOT NULL AND CAST(? AS NVARCHAR(MAX)) <> '' THEN 1 ELSE 0 END`,
          [builder, builder],
        );
      }),
    );
    return {
      builder: knex.raw(parts.map(() => '?').join(' + '), parts),
    };
  },

  // --- logical ---
  XOR: async ({ fn, knex, pt }: MapFnArgs) => {
    // T-SQL has no XOR operator. Normalize each argument to 0/1 (non-zero =
    // true, NULL = false) and chain bitwise XOR.
    const parts = await Promise.all(
      pt.arguments.map(async (arg) => {
        const { builder } = await fn(arg);
        return knex.raw(`CASE WHEN ? <> 0 THEN 1 ELSE 0 END`, [builder]);
      }),
    );
    return {
      builder: knex.raw(`(${parts.map(() => '?').join(' ^ ')})`, parts),
    };
  },

  // --- json (nvarchar-stored JSON; functions available 2016+) ---
  JSON_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pathArg = pt.arguments[1];
    if (
      pathArg?.type === JSEPNode.LITERAL &&
      typeof pathArg.value === 'string'
    ) {
      // T-SQL JSON paths don't support negative array indices (`[-1]`) —
      // `JSON_VALUE` rejects them with "JSON path is not properly formatted".
      // Negative indices aren't standard JSON-path anyway, so resolve to NULL
      // (matches the formula's documented behavior on the other dialects).
      if (/\[-\d+\]/.test(pathArg.value)) {
        return { builder: knex.raw('NULL') };
      }
      return {
        builder: knex.raw(
          `CASE WHEN ISJSON(?) = 1 THEN JSON_VALUE(?, ?) ELSE NULL END`,
          [source, source, `$${pathArg.value}`],
        ),
      };
    }
    const needle = (await fn(pathArg)).builder;
    return {
      builder: knex.raw(
        `CASE WHEN ISJSON(?) = 1 THEN JSON_VALUE(?, CONCAT('$', ?)) ELSE NULL END`,
        [source, source, needle],
      ),
    };
  },
};

export default mssql;
