import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { getWeekdayByText } from '../helpers/formulaFnHelper';

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
  DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
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
  DATETIME_DIFF: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const date1 = fn(pt.arguments[0]);
    const date2 = fn(pt.arguments[1]);
    const unit = fn(pt.arguments[2]) ?? "minute";

    return knex.raw(`
      SET @daysdiff = DATEDIFF(${date1}, ${date2})
        
      CASE
          WHEN ${unit} LIKE '%day%' or ${unit} LIKE '%dy%'
              THEN @daysdiff
          ELSE ${unit} LIKE '%year%' or ${unit} LIKE '%yy%'
              ${/*Divide by 365 to get the value in years*/''}
              THEN ROUND(@daysdiff / 365)
          ELSE ${unit} LIKE '%quarter%' or ${unit} LIKE '%q%'
              ${/*Divide by 91.25 to get the value in quarters: https://www.convertunits.com/from/days/to/quarter */''}
              THEN ROUND(@daysdiff / 91.25)
          ELSE ${unit} LIKE '%month%' or ${unit} LIKE '%m%'
              ${/*Multiply by 0.032855 to get the value in months: https://www.inchcalculator.com/convert/day-to-month/ */''}
              THEN ROUND(@daysdiff * 0.032855)
          ELSE ${unit} LIKE '%week%' or ${unit} LIKE '%wk%'
              ${/*Divide by 7 to get the value in weeks*/''}
              THEN ROUND(@daysdiff / 7)
          ELSE ${unit} LIKE '%hour%' or ${unit} LIKE '%hh%'
              ${/*Multiply by 24 to get the value in hours*/''}
              THEN ROUND(@daysdiff * 24)
          ELSE ${unit} LIKE '%minute%' or ${unit} LIKE '%mi%'
              ${/*Multiply by 1440 to get the value in minutes*/''}
              THEN ROUND(@daysdiff * 1440)
          ELSE ${unit} LIKE '%second%' or ${unit} LIKE '%s%'
              ${/*Multiply by 86400 to get the value in seconds*/''}
              THEN ROUND(@daysdiff * 86400)
          ELSE ${unit} LIKE '%millisecond%' or ${unit} LIKE '%ms%'
              ${/*Multiply by 8.64e+7 to get the value in milliseconds: https://www.inchcalculator.com/convert/day-to-millisecond/ */''}
              THEN ROUND(@daysdiff * 8.64e+7)
      END${colAlias}
    `);
  },
  WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return knex.raw(
      `(WEEKDAY(${
        pt.arguments[0].type === 'Literal'
          ? `'${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
          : fn(pt.arguments[0])
      }) - ${getWeekdayByText(
        pt?.arguments[1]?.value
      )} % 7 + 7) % 7 ${colAlias}`
    );
  },
};

export default mysql2;
