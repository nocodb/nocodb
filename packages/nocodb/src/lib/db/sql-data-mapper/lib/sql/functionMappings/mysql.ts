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
