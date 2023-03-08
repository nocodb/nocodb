import dayjs from 'dayjs';
import { convertUnits } from '../helpers/convertUnits';
import { getWeekdayByText } from '../helpers/formulaFnHelper';
import {
  convertToTargetFormat,
  getDateFormat,
} from '../../../../../utils/dateTimeUtils';
import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';

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
      `SUBSTR(${args.fn(args.pt.arguments[0])},-(${args.fn(
        args.pt.arguments[1]
      )}))${args.colAlias}`
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
    let datetime_expr1 = fn(pt.arguments[0]);
    let datetime_expr2 = fn(pt.arguments[1]);
    // JULIANDAY takes YYYY-MM-DD
    if (datetime_expr1.sql === '?' && datetime_expr1.bindings?.[0]) {
      datetime_expr1 = `'${convertToTargetFormat(
        datetime_expr1.bindings[0],
        getDateFormat(datetime_expr1.bindings[0]),
        'YYYY-MM-DD'
      )}'`;
    }

    if (datetime_expr2.sql === '?' && datetime_expr2.bindings?.[0]) {
      datetime_expr2 = `'${convertToTargetFormat(
        datetime_expr2.bindings[0],
        getDateFormat(datetime_expr2.bindings[0]),
        'YYYY-MM-DD'
      )}'`;
    }

    const rawUnit = pt.arguments[2]
      ? fn(pt.arguments[2]).bindings[0]
      : 'seconds';
    let sql;
    const unit = convertUnits(rawUnit, 'sqlite');
    switch (unit) {
      case 'seconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2}))`;
        break;
      case 'minutes':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 60`;
        break;
      case 'hours':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) / 3600`;
        break;
      case 'milliseconds':
        sql = `(strftime('%s', ${datetime_expr1}) - strftime('%s', ${datetime_expr2})) * 1000`;
        break;
      case 'weeks':
        sql = `ROUND((JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})) / 7)`;
        break;
      case 'months':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 12 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) `;
        break;
      case 'quarters':
        sql = `(strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2})) * 4 + (strftime('%m', ${datetime_expr1}) - strftime('%m', ${datetime_expr2})) / 3`;
        break;
      case 'years':
        sql = `CASE 
                WHEN (${datetime_expr2} < ${datetime_expr1}) THEN 
                (
                  (strftime('%Y', ${datetime_expr1}) - strftime('%Y', ${datetime_expr2}))
                  - (strftime('%m', ${datetime_expr1}) < strftime('%m', ${datetime_expr2})
                  OR (strftime('%m', ${datetime_expr1}) = strftime('%m', ${datetime_expr2})
                  AND strftime('%d', ${datetime_expr1}) < strftime('%d', ${datetime_expr2})))
                )
                WHEN (${datetime_expr2} > ${datetime_expr1}) THEN 
                -1 * (
                  (strftime('%Y', ${datetime_expr2}) - strftime('%Y', ${datetime_expr1}))
                  - (strftime('%m', ${datetime_expr2}) < strftime('%m', ${datetime_expr1})
                  OR (strftime('%m', ${datetime_expr2}) = strftime('%m', ${datetime_expr1})
                  AND strftime('%d', ${datetime_expr2}) < strftime('%d', ${datetime_expr1})))
                )
                ELSE 0
              END`;
        break;
      case 'days':
        sql = `JULIANDAY(${datetime_expr1}) - JULIANDAY(${datetime_expr2})`;
        break;
      default:
        sql = '';
    }
    return knex.raw(`${sql} ${colAlias}`);
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
  AND: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN ${args.knex
        .raw(
          `${args.pt.arguments
            .map((ar) => args.fn(ar, '', 'AND').toQuery())
            .join(' AND ')}`
        )
        .wrap('(', ')')
        .toQuery()} THEN 1 ELSE 0 END ${args.colAlias}`
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
        .toQuery()} THEN 1 ELSE 0 END ${args.colAlias}`
    );
  },
};

export default sqlite3;
