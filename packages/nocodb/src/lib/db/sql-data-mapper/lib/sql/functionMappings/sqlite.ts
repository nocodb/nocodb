import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { convertUnits } from '../helpers/convertUnits';
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
    const rawUnit = pt.arguments[2]
      ? fn(pt.arguments[2]).bindings[0]
      : 'seconds';
    const unit = convertUnits(rawUnit, 'sqlite');

    return knex.raw(
      `CASE
          WHEN '${unit}' LIKE '%days%'
               THEN JULIANDAY(${date1}) - JULIANDAY(${date2})
          WHEN  '${unit}' LIKE '%years%'
              ${/*Divide by 365 to get the value in years*/ ''}
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) / 365)
          WHEN  '${unit}' LIKE '%quarters%'
              ${
                /*Divide by 91.25 to get the value in quarters: https://www.convertunits.com/from/days/to/quarter */ ''
              }
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) / 91.25)
          WHEN  '${unit}' LIKE '%months%'
              ${
                /*Multiply by 0.032855 to get the value in months: https://www.inchcalculator.com/convert/day-to-month/ */ ''
              }
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) * 0.032855)
          WHEN  '${unit}' LIKE '%weeks%'
              ${/*Divide by 7 to get the value in weeks*/ ''}
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) / 7)
          WHEN  '${unit}' LIKE '%hours%'
              ${/*Multiply by 24 to get the value in hours*/ ''}
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) * 24)
          WHEN  '${unit}' LIKE '%minutes%'
              ${/*Multiply by 1440 to get the value in minutes*/ ''}
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) * 1440)
          WHEN  '${unit}' LIKE '%milliseconds%'
              ${
                /*Multiply by 8.64e+7 to get the value in milliseconds: https://www.inchcalculator.com/convert/day-to-millisecond/ */ ''
              }
              THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) * 8.64e+7)
          WHEN  '${unit}' LIKE '%seconds%'
              ${/*Multiply by 86400 to get the value in seconds*/ ''}
               THEN ROUND((JULIANDAY(${date1}) - JULIANDAY(${date2})) * 86400)
          ELSE
              JULIANDAY(${date1}) - JULIANDAY(${date2})
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
