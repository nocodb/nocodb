import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';

const pg = {
  ...commonFns,
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  ROUND: 'round',
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
  DATE_ADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN CAST(${fn(pt.arguments[0])} AS text) LIKE '%:%' THEN
        to_char(${fn(pt.arguments[0])} + INTERVAL '${fn(pt.arguments[1])} 
        ${String(fn(pt.arguments[2])).replace(
          /["']/g,
          ''
        )}', 'YYYY-MM-DD HH24:MI')
      ELSE
        to_char(${fn(pt.arguments[0])} + INTERVAL '${fn(pt.arguments[1])} 
        ${String(fn(pt.arguments[2])).replace(/["']/g, '')}', 'YYYY-MM-DD')
      END${colAlias}`
    );
  },
  DATE_SUB: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN CAST(${fn(pt.arguments[0])} AS text) LIKE '%:%' THEN
        to_char(${fn(pt.arguments[0])} - INTERVAL '${
        fn(pt.arguments[1]).argument.value
      } 
        ${String(fn(pt.arguments[2])).replace(
          /["']/g,
          ''
        )}', 'YYYY-MM-DD HH24:MI')
      ELSE
        to_char(${fn(pt.arguments[0])} - INTERVAL '${
        fn(pt.arguments[1]).argument.value
      } 
        ${String(fn(pt.arguments[2])).replace(/["']/g, '')}', 'YYYY-MM-DD')
      END${colAlias}`
    );
  }
};

export default pg;
