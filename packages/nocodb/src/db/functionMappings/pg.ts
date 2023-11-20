import dayjs from 'dayjs';
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
      builder: knex.raw(
        `${(await fn(pt.arguments[0])).builder} + (${
          (await fn(pt.arguments[1])).builder
        } || 
      '${String((await fn(pt.arguments[2])).builder).replace(
        /["']/g,
        '',
      )}')::interval${colAlias}`,
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const datetime_expr1 = (await fn(pt.arguments[0])).builder;
    const datetime_expr2 = (await fn(pt.arguments[1])).builder;
    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    let sql;
    const unit = convertUnits(rawUnit, 'pg');
    switch (unit) {
      case 'second':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP))::INTEGER`;
        break;
      case 'minute':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP))::INTEGER / 60`;
        break;
      case 'milliseconds':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP))::INTEGER * 1000`;
        break;
      case 'hour':
        sql = `EXTRACT(EPOCH from (${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP))::INTEGER / 3600`;
        break;
      case 'week':
        sql = `TRUNC(DATE_PART('day', ${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP) / 7)`;
        break;
      case 'month':
        sql = `(
                DATE_PART('year', ${datetime_expr1}::TIMESTAMP) - 
                DATE_PART('year', ${datetime_expr2}::TIMESTAMP)
               ) * 12 + (
                DATE_PART('month', ${datetime_expr1}::TIMESTAMP) - 
                DATE_PART('month', ${datetime_expr2}::TIMESTAMP)
               )`;
        break;
      case 'quarter':
        sql = `((EXTRACT(QUARTER FROM ${datetime_expr1}::TIMESTAMP) + 
                    DATE_PART('year', AGE(${datetime_expr1}, '1900/01/01')) * 4) - 1) - 
                ((EXTRACT(QUARTER FROM ${datetime_expr2}::TIMESTAMP) + 
                    DATE_PART('year', AGE(${datetime_expr2}, '1900/01/01')) * 4) - 1)`;
        break;
      case 'year':
        sql = `DATE_PART('year', AGE(${datetime_expr1}, ${datetime_expr2}))`;
        break;
      case 'day':
        sql = `DATE_PART('day', ${datetime_expr1}::TIMESTAMP - ${datetime_expr2}::TIMESTAMP)`;
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
    const numberOfCharacters = (await fn(pt.arguments[2] ?? '')).builder;
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
};

export default pg;
