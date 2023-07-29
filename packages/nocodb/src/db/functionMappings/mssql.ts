import dayjs from 'dayjs';
import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import { convertUnits } from '~/helpers/convertUnits';
import { getWeekdayByText } from '~/helpers/formulaFnHelper';

const mssql = {
  ...commonFns,
  MIN: async (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex
          .raw(`\n\tElse ${(await args.fn(arg)).builder.toQuery()}`)
          .toQuery();
      } else {
        query += args.knex
          .raw(
            `\n\tWhen  ${(
              await Promise.all(
                args.pt.arguments
                  .filter((_, j) => +i !== j)
                  .map(
                    async (arg1) =>
                      `${(await args.fn(arg)).builder.toQuery()} < ${(
                        await args.fn(arg1)
                      ).builder.toQuery()}`,
                  ),
              )
            ).join(' And ')} Then ${(await args.fn(arg)).builder.toQuery()}`,
          )
          .toQuery();
      }
    }
    return { builder: args.knex.raw(`Case ${query}\n End${args.colAlias}`) };
  },
  MAX: async (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex
          .raw(`\nElse ${(await args.fn(arg)).builder.toQuery()}`)
          .toQuery();
      } else {
        query += args.knex
          .raw(
            `\nWhen  ${args.pt.arguments
              .filter((_, j) => +i !== j)
              .map(
                async (arg1) =>
                  `${(await args.fn(arg)).builder.toQuery()} > ${(
                    await args.fn(arg1)
                  ).builder.toQuery()}`,
              )
              .join(' And ')} Then ${(await args.fn(arg)).builder.toQuery()}`,
          )
          .toQuery();
      }
    }

    return { builder: args.knex.raw(`Case ${query}\n End${args.colAlias}`) };
  },
  LOG: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `LOG(${(
          await Promise.all(
            args.pt.arguments
              .reverse()
              .map(async (ar) => (await args.fn(ar)).builder.toQuery()),
          )
        ).join(',')})${args.colAlias}`,
      ),
    };
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
  SEARCH: async (args: MapFnArgs) => {
    args.pt.callee.name = 'CHARINDEX';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ISNUMERIC(${(
          await args.fn(args.pt.arguments[0])
        ).builder.toQuery()}) = 1 THEN FLOOR(${(
          await args.fn(args.pt.arguments[0])
        ).builder.toQuery()}) ELSE 0 END${args.colAlias}`,
      ),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(
          `CAST(${(await args.fn(args.pt.arguments[0])).builder} as FLOAT)${
            args.colAlias
          }`,
        )
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const dateIN = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        `CASE
      WHEN ${(await fn(pt.arguments[0])).builder} LIKE '%:%' THEN
        FORMAT(DATEADD(${String((await fn(pt.arguments[2])).builder).replace(
          /["']/g,
          '',
        )}, 
        ${dateIN > 0 ? '+' : ''}${(await fn(pt.arguments[1])).builder}, ${
          (await fn(pt.arguments[0])).builder
        }), 'yyyy-MM-dd HH:mm:ss')
      ELSE
       FORMAT(DATEADD(${String((await fn(pt.arguments[2])).builder).replace(
         /["']/g,
         '',
       )}, 
       ${dateIN > 0 ? '+' : ''}${(await fn(pt.arguments[1])).builder}, ${
          (await fn(pt.arguments[0])).builder
        }), 'yyyy-MM-dd')
      END${colAlias}`,
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const datetime_expr1 = (await fn(pt.arguments[0])).builder;
    const datetime_expr2 = (await fn(pt.arguments[1])).builder;
    const rawUnit = pt.arguments[2]
      ? (await fn(pt.arguments[2])).builder.bindings[0]
      : 'seconds';
    const unit = convertUnits(rawUnit, 'mssql');
    return {
      builder: knex.raw(
        `DATEDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) ${colAlias}`,
      ),
    };
  },
  WEEKDAY: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // DATEPART(WEEKDAY, DATE): sunday = 1, monday = 2, ..., saturday = 7
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(DATEPART(WEEKDAY, ${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : fn(pt.arguments[0])
        }) - 2 - ${getWeekdayByText(
          pt?.arguments[1]?.value,
        )} % 7 + 7) % 7 ${colAlias}`,
      ),
    };
  },
  AND: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'AND')).builder.toQuery(),
                ),
              )
            ).join(' AND ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN 1 ELSE 0 END ${args.colAlias}`,
      ),
    };
  },
  OR: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CASE WHEN ${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar, '', 'OR')).builder.toQuery(),
                ),
              )
            ).join(' OR ')}`,
          )
          .wrap('(', ')')
          .toQuery()} THEN 1 ELSE 0 END ${args.colAlias}`,
      ),
    };
  },
};

export default mssql;
