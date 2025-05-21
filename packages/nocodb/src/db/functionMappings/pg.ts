import dayjs from 'dayjs';
import { FormulaDataTypes } from 'nocodb-sdk';
import commonFns from './commonFns';
import type { MapFnArgs } from '~/db/mapFunctionName';
import { convertUnits } from '~/helpers/convertUnits';
import { getWeekdayByText } from '~/helpers/formulaFnHelper';

const pg = {
  ...commonFns,
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  POWER: 'pow',
  SQRT: 'sqrt',
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
  MID: 'SUBSTR',
  FLOAT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    return {
      builder: knex.raw(`CAST(? as DOUBLE PRECISION)`, [source]).wrap('(', ')'),
    };
  },
  ROUND: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const precision = pt?.arguments[1]
      ? (await fn(pt.arguments[1])).builder
      : 0;

    return {
      builder: knex.raw(`ROUND((?)::numeric, ?)`, [source, precision]),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const typeCast =
      pt.arguments[0].dataType !== FormulaDataTypes.DATE ? '::DATE' : '';
    const modifier = (await fn(pt.arguments[1])).builder;
    const scale = String((await fn(pt.arguments[2])).builder).replace(
      /["']/g,
      '',
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
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
    const datetime_expr1 = (await fn(pt.arguments[0])).builder;
    const datetime_expr2 = (await fn(pt.arguments[1])).builder;
    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    const expr1_typecast = [
      FormulaDataTypes.DATE,
      FormulaDataTypes.STRING,
    ].includes(pt.arguments[0].dataType)
      ? '::TIMESTAMP'
      : '';
    const expr2_typecast = [
      FormulaDataTypes.DATE,
      FormulaDataTypes.STRING,
    ].includes(pt.arguments[1].dataType)
      ? '::TIMESTAMP'
      : '';

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
    return { builder: knex.raw(`${sql}`) };
  },
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // isodow: the day of the week as Monday (1) to Sunday (7)
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(EXTRACT(ISODOW FROM ${
          pt.arguments[0].type === 'Literal'
            ? `date '${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - 1 - ${getWeekdayByText(
          pt?.arguments[1]?.value,
        )} % 7 + 7) ::INTEGER % 7`,
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
  DAY: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Day' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP))`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Month' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP))`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Year' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP))`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Hour' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP))`,
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
      builder: args.knex.raw(`CASE WHEN ? THEN TRUE ELSE FALSE END`, [clause]),
    };
  },
  OR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' OR ',
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
      builder: args.knex.raw(`CASE WHEN ? THEN TRUE ELSE FALSE END`, [clause]),
    };
  },
  SUBSTR: async ({ fn, knex, pt }: MapFnArgs) => {
    const str = (await fn(pt.arguments[0])).builder;
    const positionFrom = (await fn(pt.arguments[1] ?? 1)).builder;
    const numberOfCharacters = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder
      : null;
    if (numberOfCharacters) {
      return {
        builder: knex.raw(`SUBSTR(?::TEXT, ?, ?)`, [
          str,
          positionFrom,
          numberOfCharacters,
        ]),
      };
    } else {
      return {
        builder: knex.raw(`SUBSTR(?::TEXT, ?)`, [str, positionFrom]),
      };
    }
  },
  MOD: async ({ fn, knex, pt }: MapFnArgs) => {
    const x = (await fn(pt.arguments[0])).builder;
    const y = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(`MOD((${x})::NUMERIC, (${y})::NUMERIC)`),
    };
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
  XOR: async ({ fn, knex, pt }: MapFnArgs) => {
    const predicates = (pt.arguments.map(() => '?') as string[]).join(' # ');
    const parsedArguments = await Promise.all(
      pt.arguments.map(async (arg) => {
        const query = (await fn(arg)).builder;
        return {
          builder: knex.raw(
            `CASE WHEN :query IS NOT NULL AND :query::boolean = true THEN 1 ELSE 0 END`,
            { query },
          ),
        };
      }),
    );
    return {
      builder: knex.raw(
        `${predicates}`,
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
  VALUE: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;
    return {
      builder: knex.raw(
        `CASE
  WHEN :value IS NULL OR REGEXP_REPLACE(:value ::TEXT, '[^\\d.]+', '', 'g') IN ('.', '') OR LENGTH(REGEXP_REPLACE(:value ::TEXT, '[^.]+', '', 'g')) > 1 THEN NULL
  WHEN LENGTH(REGEXP_REPLACE(:value ::TEXT, '[^%]', '','g')) > 0 THEN POW(-1, LENGTH(REGEXP_REPLACE(:value ::TEXT, '[^-]','', 'g'))) * (REGEXP_REPLACE(:value ::TEXT, '[^\\d.]+', '', 'g'))::NUMERIC / 100
  ELSE POW(-1, LENGTH(REGEXP_REPLACE(:value ::TEXT, '[^-]', '', 'g'))) * (REGEXP_REPLACE(:value ::TEXT, '[^\\d.]+', '', 'g'))::NUMERIC
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
    const needle = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN (?)::jsonb IS NOT NULL THEN jsonb_path_query_first((?)::jsonb, CONCAT('$', ?)::jsonpath) ELSE NULL END`,
        [source, source, needle],
      ),
    };
  },
};

export default pg;
