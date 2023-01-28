import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { convertUnits } from '../helpers/convertUnits';
import { getWeekdayByText } from '../helpers/formulaFnHelper';

const pg = {
  ...commonFns,
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  POWER: 'pow',
  SQRT: 'sqrt',
  SEARCH: (args: MapFnArgs) => {
    return args.knex.raw(
      `POSITION(${args.knex.raw(
        args.fn(args.pt.arguments[1]).toQuery()
      )} in ${args.knex.raw(args.fn(args.pt.arguments[0]).toQuery())})${
        args.colAlias
      }`
    );
  },
  INT(args: MapFnArgs) {
    // todo: correction
    return args.knex.raw(
      `REGEXP_REPLACE(COALESCE(${args.fn(
        args.pt.arguments[0]
      )}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')${args.colAlias}`
    );
  },
  MID: 'SUBSTR',
  FLOAT: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex
      .raw(`CAST(${fn(pt.arguments[0])} as DOUBLE PRECISION)${colAlias}`)
      .wrap('(', ')');
  },
  ROUND: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `ROUND((${fn(pt.arguments[0])})::numeric, ${
        pt?.arguments[1] ? fn(pt.arguments[1]) : 0
      }) ${colAlias}`
    );
  },
  DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `${fn(pt.arguments[0])} + (${fn(pt.arguments[1])} || 
      '${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}')::interval${colAlias}`
    );
  },
  DATETIME_DIFF: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const datetime_expr1 = fn(pt.arguments[0]);
    const datetime_expr2 = fn(pt.arguments[1]);
    const rawUnit = pt.arguments[2]
      ? fn(pt.arguments[2]).bindings[0]
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
    return knex.raw(`${sql} ${colAlias}`);
  },
  WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // isodow: the day of the week as Monday (1) to Sunday (7)
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return knex.raw(
      `(EXTRACT(ISODOW FROM ${
        pt.arguments[0].type === 'Literal'
          ? `date '${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
          : fn(pt.arguments[0])
      }) - 1 - ${getWeekdayByText(
        pt?.arguments[1]?.value
      )} % 7 + 7) ::INTEGER % 7 ${colAlias}`
    );
  },
  AND: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN ${args.knex
        .raw(
          `${args.pt.arguments
            .map((ar) => args.fn(ar, '', 'AND').toQuery())
            .join(' AND ')}`
        )
        .wrap('(', ')')
        .toQuery()} THEN TRUE ELSE FALSE END ${args.colAlias}`
    );
  },
  OR: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN ${args.knex
        .raw(
          `${args.pt.arguments
            .map((ar) => args.fn(ar, '', 'OR').toQuery())
            .join(' OR ')}`
        )
        .wrap('(', ')')
        .toQuery()} THEN TRUE ELSE FALSE END ${args.colAlias}`
    );
  },
  SUBSTR: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const str = fn(pt.arguments[0]);
    const positionFrom = fn(pt.arguments[1] ?? 1);
    const numberOfCharacters = fn(pt.arguments[2] ?? '');
    return knex.raw(
      `SUBSTR(${str}::TEXT, ${positionFrom}${
        numberOfCharacters ? ', ' + numberOfCharacters : ''
      })${colAlias}`
    );
  },
  MOD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const x = fn(pt.arguments[0]);
    const y = fn(pt.arguments[1]);
    return knex.raw(`MOD((${x})::NUMERIC, (${y})::NUMERIC) ${colAlias}`);
  },
};

export default pg;
