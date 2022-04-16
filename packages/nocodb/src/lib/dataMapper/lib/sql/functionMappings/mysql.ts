import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';

const mysql2 = {
  ...commonFns,
  LEN: 'CHAR_LENGTH',
  MIN: 'LEAST',
  MAX: 'GREATEST',
  SEARCH: (args: MapFnArgs) => {
    args.pt.callee.name = 'LOCATE';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: (args: MapFnArgs) => {
    return args.knex.raw(
      `CAST(${args.fn(args.pt.arguments[0])} as SIGNED)${args.colAlias}`
    );
  },
  LEFT: (args: MapFnArgs) => {
    return args.knex.raw(
      `SUBSTR(${args.fn(args.pt.arguments[0])},1,${args.fn(
        args.pt.arguments[1]
      )})${args.colAlias}`
    );
  },
  RIGHT: (args: MapFnArgs) => {
    return args.knex.raw(
      `SUBSTR(${args.fn(args.pt.arguments[0])},-${args.fn(
        args.pt.arguments[1]
      )})${args.colAlias}`
    );
  },
  MID: 'SUBSTR',
  FLOAT: (args: MapFnArgs) => {
    return args.knex
      .raw(`CAST(${args.fn(args.pt.arguments[0])} as DOUBLE)${args.colAlias}`)
      .wrap('(', ')');
  },
  DATE_ADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[0])} LIKE '%:%' THEN
        DATE_FORMAT(DATE_ADD(${fn(pt.arguments[0])}, INTERVAL 
        ${fn(pt.arguments[1])} ${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}), '%Y-%m-%d %H:%i')
      ELSE
        DATE(DATE_ADD(${fn(pt.arguments[0])}, INTERVAL 
        ${fn(pt.arguments[1])} ${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}))
      END${colAlias}`
    );
  },
  DATE_SUB: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[0])} LIKE '%:%' THEN
        DATE_FORMAT(DATE_ADD(${fn(pt.arguments[0])}, INTERVAL 
        ${fn(pt.arguments[1])}.argument.value 
        ${String(fn(pt.arguments[2])).replace(/["']/g, '')}), '%Y-%m-%d %H:%i')
      ELSE
        DATE(DATE_ADD(${fn(pt.arguments[0])}, INTERVAL 
        ${fn(pt.arguments[1])}.argument.value 
        ${String(fn(pt.arguments[2])).replace(/["']/g, '')}))
      END${colAlias}`
    );
  }
};

export default mysql2;
