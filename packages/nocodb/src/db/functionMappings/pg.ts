import dayjs from 'dayjs';
import { FormulaDataTypes } from 'nocodb-sdk';
import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
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
    return {
      builder: args.knex.raw(
        `POSITION(${args.knex.raw(
          (await args.fn(args.pt.arguments[1])).builder.toQuery(),
        )} in ${args.knex.raw(
          (await args.fn(args.pt.arguments[0])).builder.toQuery(),
        )})${args.colAlias}`,
      ),
    };
  },
  INT(args: MapFnArgs) {
    // todo: correction
    return {
      builder: args.knex.raw(
        `REGEXP_REPLACE(COALESCE(${args.fn(
          args.pt.arguments[0],
        )}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')${args.colAlias}`,
      ),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex
        .raw(
          `CAST(${
            (await fn(pt.arguments[0])).builder
          } as DOUBLE PRECISION)${colAlias}`,
        )
        .wrap('(', ')'),
    };
  },
  ROUND: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `ROUND((${(await fn(pt.arguments[0])).builder})::numeric, ${
          pt?.arguments[1] ? (await fn(pt.arguments[1])).builder : 0
        }) ${colAlias}`,
      ),
    };
  },
  DATEADD: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex
        .raw(
          `(${(await fn(pt.arguments[0])).builder})${
            pt.arguments[0].dataType !== FormulaDataTypes.DATE ? '::DATE' : ''
          } + (${(await fn(pt.arguments[1])).builder} ||
      '${String((await fn(pt.arguments[2])).builder).replace(
        /["']/g,
        '',
      )}')::interval${colAlias}`,
        )
        .wrap('(', ')'),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
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
    return { builder: knex.raw(`${sql} ${colAlias}`) };
  },
  WEEKDAY: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
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
        )} % 7 + 7) ::INTEGER % 7 ${colAlias}`,
      ),
    };
  },
  DATESTR: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `TO_CHAR((${
          (await fn(pt?.arguments[0])).builder
        }), 'YYYY-MM-DD')::text ${colAlias}`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Day' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP)) ${colAlias}`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Month' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP)) ${colAlias}`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Year' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP)) ${colAlias}`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT('Hour' FROM ((${
          (await fn(pt?.arguments[0])).builder
        })::TIMESTAMP)) ${colAlias}`,
      ),
    };
  },
  AND: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'AND')).builder.toQuery(),
                ),
              )
            ).join(' AND ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN TRUE ELSE FALSE END ${args.colAlias}`,
      ),
    };
  },
  OR: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'OR')).builder.toQuery(),
                ),
              )
            ).join(' OR ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN TRUE ELSE FALSE END ${args.colAlias}`,
      ),
    };
  },
  SUBSTR: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const str = (await fn(pt.arguments[0])).builder;
    const positionFrom = (await fn(pt.arguments[1] ?? 1)).builder;
    const numberOfCharacters = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder
      : null;
    return {
      builder: knex.raw(
        `SUBSTR(${str}::TEXT, ${positionFrom}${
          numberOfCharacters ? ', ' + numberOfCharacters : ''
        })${colAlias}`,
      ),
    };
  },
  MOD: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const x = (await fn(pt.arguments[0])).builder;
    const y = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(`MOD((${x})::NUMERIC, (${y})::NUMERIC) ${colAlias}`),
    };
  },
  REGEX_MATCH: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN REGEXP_MATCH(${source}::TEXT, ${pattern}::TEXT) IS NULL THEN 0 ELSE 1 END ${colAlias}`,
      ),
    };
  },
  REGEX_EXTRACT: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;

    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        // use `SUBSTRING` since REGEXP_MATCH returns array value
        // `REGEXP_MATCH(${source}::TEXT, ${pattern}::TEXT) ${colAlias}`,
        `SUBSTRING(??::TEXT from ??::TEXT) ${colAlias}`,
        [source, pattern],
      ),
    };
  },
  REGEX_REPLACE: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;

    const replacement = (await fn(pt.arguments[2])).builder;
    return {
      builder: knex.raw(
        `REGEXP_REPLACE(${source}::TEXT, ${pattern}::TEXT, ${replacement}::TEXT, 'g') ${colAlias}`,
      ),
    };
  },
  XOR: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const args = await Promise.all(
      pt.arguments.map(async (arg) => {
        const query = (await fn(arg)).builder.toString();
        return `CASE WHEN ${query}  IS NOT NULL AND ${query}::boolean = true THEN 1 ELSE 0 END`;
      }),
    );
    return {
      builder: knex.raw(`${args.join(' # ')} ${colAlias}`),
    };
  },
  COUNT: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `${(
          await Promise.all(
            pt.arguments.map(async (arg) => {
              const { builder } = await fn(arg);
              return `CASE WHEN pg_typeof(${builder}) IN ('smallint', 'integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision') AND ${builder} IS NOT NULL THEN 1 ELSE 0 END`;
            }),
          )
        ).join(' + ')} ${colAlias}`,
      ),
    };
  },
  COUNTA: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `${(
          await Promise.all(
            pt.arguments.map(async (arg) => {
              const { builder } = await fn(arg);
              return `CASE WHEN ${builder} IS NOT NULL AND ${builder}::text != '' THEN 1 ELSE 0 END`;
            }),
          )
        ).join(' + ')} ${colAlias}`,
      ),
    };
  },
  VALUE: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder.toString();

    return {
      builder: knex.raw(
        `CASE
  WHEN ${value} IS NULL OR REGEXP_REPLACE(${value}::TEXT, '[^\\d.]+', '', 'g') IN ('.', '') OR LENGTH(REGEXP_REPLACE(${value}::TEXT, '[^.]+', '', 'g')) > 1 THEN NULL
  WHEN LENGTH(REGEXP_REPLACE(${value}::TEXT, '[^%]', '','g')) > 0 THEN POW(-1, LENGTH(REGEXP_REPLACE(${value}::TEXT, '[^-]','', 'g'))) * (REGEXP_REPLACE(${value}::TEXT, '[^\\d.]+', '', 'g'))::NUMERIC / 100
  ELSE POW(-1, LENGTH(REGEXP_REPLACE(${value}::TEXT, '[^-]', '', 'g'))) * (REGEXP_REPLACE(${value}::TEXT, '[^\\d.]+', '', 'g'))::NUMERIC
END ${colAlias}`,
      ),
    };
  },
  ROUNDDOWN: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(FLOOR((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder})::numeric(30,${precisionBuilder}))${colAlias}`,
      ),
    };
  },
  ROUNDUP: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(CEIL((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder})::numeric(30,${precisionBuilder}))${colAlias}`,
      ),
    };
  },
  STRING: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `(${(await args.fn(args.pt.arguments[0])).builder})::text ${
          args.colAlias
        }`,
      ),
    };
  },
  BOOLEAN: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `(${(await args.fn(args.pt.arguments[0])).builder})::boolean${
          args.colAlias
        }`,
      ),
    };
  },
  JSON_EXTRACT: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CASE WHEN (${
          (await fn(pt.arguments[0])).builder
        })::jsonb IS NOT NULL THEN jsonb_path_query_first((${
          (await fn(pt.arguments[0])).builder
        })::jsonb, CONCAT('$', ${
          (await fn(pt.arguments[1])).builder
        })::jsonpath) ELSE NULL END${colAlias}`,
      ),
    };
  },
};

export default pg;
