import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { convertUnits } from '../helpers/convertUnits';
import { getWeekdayByText } from '../helpers/formulaFnHelper';

const mssql = {
  ...commonFns,
  MIN: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\n\tElse ${args.fn(arg).toQuery()}`).toQuery();
      } else {
        query += args.knex
          .raw(
            `\n\tWhen  ${args.pt.arguments
              .filter((_, j) => +i !== j)
              .map(
                (arg1) =>
                  `${args.fn(arg).toQuery()} < ${args.fn(arg1).toQuery()}`
              )
              .join(' And ')} Then ${args.fn(arg).toQuery()}`
          )
          .toQuery();
      }
    }
    return args.knex.raw(`Case ${query}\n End${args.colAlias}`);
  },
  MAX: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\nElse ${args.fn(arg).toQuery()}`).toQuery();
      } else {
        query += args.knex
          .raw(
            `\nWhen  ${args.pt.arguments
              .filter((_, j) => +i !== j)
              .map(
                (arg1) =>
                  `${args.fn(arg).toQuery()} > ${args.fn(arg1).toQuery()}`
              )
              .join(' And ')} Then ${args.fn(arg).toQuery()}`
          )
          .toQuery();
      }
    }

    return args.knex.raw(`Case ${query}\n End${args.colAlias}`);
  },
  LOG: (args: MapFnArgs) => {
    return args.knex.raw(
      `LOG(${args.pt.arguments
        .reverse()
        .map((ar) => args.fn(ar).toQuery())
        .join(',')})${args.colAlias}`
    );
  },
  MOD: (pt) => {
    Object.assign(pt, {
      type: 'BinaryExpression',
      operator: '%',
      left: pt.arguments[0],
      right: pt.arguments[1],
    });
  },
  REPEAT: 'REPLICATE',
  NOW: 'getdate',
  SEARCH: (args: MapFnArgs) => {
    args.pt.callee.name = 'CHARINDEX';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN ISNUMERIC(${args
        .fn(args.pt.arguments[0])
        .toQuery()}) = 1 THEN FLOOR(${args
        .fn(args.pt.arguments[0])
        .toQuery()}) ELSE 0 END${args.colAlias}`
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
        FORMAT(DATEADD(${String(fn(pt.arguments[2])).replace(/["']/g, '')}, 
        ${dateIN > 0 ? '+' : ''}${fn(pt.arguments[1])}, ${fn(
        pt.arguments[0]
      )}), 'yyyy-MM-dd HH:mm')
      ELSE
       FORMAT(DATEADD(${String(fn(pt.arguments[2])).replace(/["']/g, '')}, 
       ${dateIN > 0 ? '+' : ''}${fn(pt.arguments[1])}, ${fn(
        pt.arguments[0]
      )}), 'yyyy-MM-dd')
      END${colAlias}`
    );
  },
  DATETIME_DIFF: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const datetime_expr1 = fn(pt.arguments[0]);
    const datetime_expr2 = fn(pt.arguments[1]);
    const rawUnit = pt.arguments[2]
      ? fn(pt.arguments[2]).bindings[0]
      : 'seconds';
    const unit = convertUnits(rawUnit, 'mssql');
    return knex.raw(
      `DATEDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) ${colAlias}`
    );
  },
  WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // DATEPART(WEEKDAY, DATE): sunday = 1, monday = 2, ..., saturday = 7
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return knex.raw(
      `(DATEPART(WEEKDAY, ${
        pt.arguments[0].type === 'Literal'
          ? `'${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
          : fn(pt.arguments[0])
      }) - 2 - ${getWeekdayByText(
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

export default mssql;
