import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { getWeekdayByText } from '../helpers/formulaFnHelper';

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
      right: args.pt.arguments[1],
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
  DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const dateIN = fn(pt.arguments[1]);
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[0])} LIKE '%:%' THEN 
        STRFTIME('%Y-%m-%d %H:%M', DATETIME(DATETIME(${fn(
          pt.arguments[0]
        )}, 'localtime'), 
        ${dateIN > 0 ? '+' : ''}${fn(pt.arguments[1])} || ' ${String(
        fn(pt.arguments[2])
      ).replace(/["']/g, '')}'))
      ELSE 
        DATE(DATETIME(${fn(pt.arguments[0])}, 'localtime'), 
        ${dateIN > 0 ? '+' : ''}${fn(pt.arguments[1])} || ' ${String(
        fn(pt.arguments[2])
      ).replace(/["']/g, '')}')
      END${colAlias}`
    );
  },
  DATETIME_DIFF: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const date1 = fn(pt.arguments[0]);
    const date2 = fn(pt.arguments[1]);
    const unit = fn(pt.arguments[2]);

    return knex.raw(
      `WITH const AS (JULIANDAY(${date1}) - JULIANDAY(${date2}) AS daysdiff)
      
      CASE
          WHEN ${unit} LIKE '%day%' or ${unit} LIKE '%dy%'
               THEN const.daysdiff
          ELSE ${unit} LIKE '%year%' or ${unit} LIKE '%y%'
               THEN ROUND(const.daysdiff / 365)
          ELSE ${unit} LIKE '%quarter%' or ${unit} LIKE '%q%'
               THEN ROUND(const.daysdiff / 91.25)
          ELSE ${unit} LIKE '%month%' or ${unit} LIKE '%m%'
               THEN ROUND(const.daysdiff / 30.417)
          ELSE ${unit} LIKE '%week%' or ${unit} LIKE '%wk%'
               THEN ROUND(const.daysdiff / 7)
          ELSE ${unit} LIKE '%hour%' or ${unit} LIKE '%hh%'
               THEN ROUND(const.daysdiff * 24)
          ELSE ${unit} LIKE '%minute%' or ${unit} LIKE '%mi%'
               THEN ROUND(const.daysdiff * 1440)
          ELSE ${unit} LIKE '%second%' or ${unit} LIKE '%s%'
               THEN ROUND(const.daysdiff * 86400)
          ELSE ${unit} LIKE '%millisecond%' or ${unit} LIKE '%ms%'
               THEN ROUND(const.daysdiff * 8.64e+7)
      END${colAlias}
      `
    );
  },
  WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // strftime('%w', date) - day of week 0 - 6 with Sunday == 0
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return knex.raw(
      `(strftime('%w', ${
        pt.arguments[0].type === 'Literal'
          ? `'${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
          : fn(pt.arguments[0])
      }) - 1 - ${getWeekdayByText(
        pt?.arguments[1]?.value
      )} % 7 + 7) % 7 ${colAlias}`
    );
  },
};

export default sqlite3;
