import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { convertUnits } from '../helpers/convertUnits';
import { getWeekdayByText } from '../helpers/formulaFnHelper';
import {
  convertToTargetFormat,
  getDateFormat,
} from '../../../../../utils/dateTimeUtils';

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
    datetime_expr1 = convertToTargetFormat(
      datetime_expr1,
      getDateFormat(datetime_expr1),
      'YYYY-MM-DD'
    );
    datetime_expr2 = convertToTargetFormat(
      datetime_expr2,
      getDateFormat(datetime_expr2),
      'YYYY-MM-DD'
    );
    const rawUnit = pt.arguments[2]
      ? fn(pt.arguments[2]).bindings[0]
      : 'seconds';
    let sql;
    const unit = convertUnits(rawUnit, 'sqlite');
    switch (unit) {
      case 'seconds':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) * 86400)`;
        break;
      case 'minutes':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) * 1440)`;
        break;
      case 'hours':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) * 24)`;
        break;
      case 'milliseconds':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) * 86400000)`;
        break;
      case 'weeks':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) / 7)`;
        break;
      case 'months':
        sql = `(ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) / 365))
        * 12 + (ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) / 365 / 12))`;
        break;
      case 'quarters':
        sql = `
            ROUND((JULIANDAY('${datetime_expr1}')) / 365 / 4) -
            ROUND((JULIANDAY('${datetime_expr2}')) / 365 / 4) +
            (ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) / 365)) * 4
        `;
        break;
      case 'years':
        sql = `ROUND((JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')) / 365)`;
        break;
      case 'days':
        sql = `JULIANDAY('${datetime_expr1}') - JULIANDAY('${datetime_expr2}')`;
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
};

export default sqlite3;
