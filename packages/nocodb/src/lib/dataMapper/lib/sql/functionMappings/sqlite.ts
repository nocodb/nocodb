import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';

const sqlite3 = {
  ...commonFns,
  LEN: 'LENGTH',
  CEILING(args) {
    return args.knex.raw(
      `round(${args.fn(args.pt.arguments[0])} + 0.5)${args.colAlias}`
    );
  },
  FLOOR(args) {
    return args.knex.raw(
      `round(${args.fn(args.pt.arguments[0])} - 0.5)${args.colAlias}`
    );
  },
  MOD: (args: MapFnArgs) => {
    return args.fn({
      type: 'BinaryExpression',
      operator: '%',
      left: args.pt.arguments[0],
      right: args.pt.arguments[1]
    });
  },
  REPEAT(args: MapFnArgs) {
    return args.knex.raw(
      `replace(printf('%.' || ${args.fn(
        args.pt.arguments[1]
      )} || 'c', '/'),'/',${args.fn(args.pt.arguments[0])})${args.colAlias}`
    );
  },
  NOW: 'DATE',
  SEARCH: 'INSTR',
  INT(args: MapFnArgs) {
    return args.knex.raw(
      `CAST(${args.fn(args.pt.arguments[0])} as INTEGER)${args.colAlias}`
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
      .raw(`CAST(${args.fn(args.pt.arguments[0])} as FLOAT)${args.colAlias}`)
      .wrap('(', ')');
  },
  DATE_ADD: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE
      WHEN ${args.fn(args.pt.arguments[0])} LIKE '%:%' THEN 
        STRFTIME('%Y-%m-%d %H:%M', DATETIME(DATETIME(${args.fn(args.pt.arguments[0])}, 'localtime'), 
        '+${args.fn(args.pt.arguments[1])} ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}'))
      ELSE 
        DATE(DATETIME(${args.fn(args.pt.arguments[0])}, 'localtime'), 
        '+${args.fn(args.pt.arguments[1])} ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}')
      END${args.colAlias}`
    );
  },
  DATE_SUB: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE
      WHEN ${args.fn(args.pt.arguments[0])} LIKE '%:%' THEN 
        STRFTIME('%Y-%m-%d %H:%M', DATETIME(DATETIME(${args.fn(args.pt.arguments[0])}, 'localtime'),
        '-${args.fn(args.pt.arguments[1]).argument.value} ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}'))
      ELSE 
        DATE(DATETIME(${args.fn(args.pt.arguments[0])}, 'localtime'), 
        '-${args.fn(args.pt.arguments[1]).argument.value} ${String(args.fn(args.pt.arguments[2])).replace(/["']/g, "")}')
      END${args.colAlias}`
    );
  }
};

export default sqlite3;
