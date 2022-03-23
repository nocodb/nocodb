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
  FLOAT: (args: MapFnArgs) => {
    return args.knex
      .raw(
        `CAST(${args.fn(args.pt.arguments[0])} as DOUBLE PRECISION)${
          args.colAlias
        }`
      )
      .wrap('(', ')');
  },
  DATE_ADD: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE
      WHEN CAST(${args.fn(args.pt.arguments[0])} AS text) LIKE '%:%' THEN
        to_char(${args.fn(args.pt.arguments[0])} + INTERVAL '${args.fn(args.pt.arguments[1])} 
        ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}', 'YYYY-MM-DD HH24:MI')
      ELSE
        to_char(${args.fn(args.pt.arguments[0])} + INTERVAL '${args.fn(args.pt.arguments[1])} 
        ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}', 'YYYY-MM-DD')
      END${args.colAlias}`
    );
  },
  DATE_SUB: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE
      WHEN CAST(${args.fn(args.pt.arguments[0])} AS text) LIKE '%:%' THEN
        to_char(${args.fn(args.pt.arguments[0])} - INTERVAL '${args.fn(args.pt.arguments[1]).argument.value} 
        ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}', 'YYYY-MM-DD HH24:MI')
      ELSE
        to_char(${args.fn(args.pt.arguments[0])} - INTERVAL '${args.fn(args.pt.arguments[1]).argument.value} 
        ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}', 'YYYY-MM-DD')
      END${args.colAlias}`
    );
  }
};

export default pg;
