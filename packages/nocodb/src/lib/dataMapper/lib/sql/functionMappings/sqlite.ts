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
  DATE_ADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[0])} LIKE '%:%' THEN 
        STRFTIME('%Y-%m-%d %H:%M', DATETIME(DATETIME(${fn(
          pt.arguments[0]
        )}, 'localtime'), 
        '+${fn(pt.arguments[1])} ${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}'))
      ELSE 
        DATE(DATETIME(${fn(pt.arguments[0])}, 'localtime'), 
        '+${fn(pt.arguments[1])} ${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}')
      END${colAlias}`
    );
  },
  DATE_SUB: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[0])} LIKE '%:%' THEN 
        STRFTIME('%Y-%m-%d %H:%M', DATETIME(DATETIME(${fn(
          pt.arguments[0]
        )}, 'localtime'),
        '-${fn(pt.arguments[1]).argument.value} ${String(
        fn(pt.arguments[2])
      ).replace(/["']/g, '')}'))
      ELSE 
        DATE(DATETIME(${fn(pt.arguments[0])}, 'localtime'), 
        '-${fn(pt.arguments[1]).argument.value} ${String(
        fn(pt.arguments[2])
      ).replace(/["']/g, '')}')
      END${colAlias}`
    );
  }
};

export default sqlite3;
