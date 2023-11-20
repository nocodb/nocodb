import dayjs from 'dayjs';
import commonFns from './commonFns';
import type { MapFnArgs } from '../mapFunctionName';
import { convertUnits } from '~/helpers/convertUnits';
import { getWeekdayByText } from '~/helpers/formulaFnHelper';

const mysql2 = {
  ...commonFns,
  LEN: 'CHAR_LENGTH',
  MIN: 'LEAST',
  MAX: 'GREATEST',
  SEARCH: async (args: MapFnArgs) => {
    args.pt.callee.name = 'LOCATE';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `CAST(${(await args.fn(args.pt.arguments[0])).builder} as SIGNED)${
          args.colAlias
        }`,
      ),
    };
  },
  LEFT: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `SUBSTR(${(await args.fn(args.pt.arguments[0])).builder},1,${
          (await args.fn(args.pt.arguments[1])).builder
        })${args.colAlias}`,
      ),
    };
  },
  RIGHT: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `SUBSTR(${(await args.fn(args.pt.arguments[0])).builder}, -(${
          (await args.fn(args.pt.arguments[1])).builder
        }))${args.colAlias}`,
      ),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(
          `CAST(CAST(${
            (await args.fn(args.pt.arguments[0])).builder
          } as CHAR) AS DOUBLE)${args.colAlias}`,
        )
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `CASE
      WHEN ${(await fn(pt.arguments[0])).builder} LIKE '%:%' THEN
        DATE_FORMAT(DATE_ADD(${(await fn(pt.arguments[0])).builder}, INTERVAL
        ${(await fn(pt.arguments[1])).builder} ${String(
          (await fn(pt.arguments[2])).builder,
        ).replace(/["']/g, '')}), '%Y-%m-%d %H:%i:%s')
      ELSE
        DATE(DATE_ADD(${(await fn(pt.arguments[0])).builder}, INTERVAL
        ${(await fn(pt.arguments[1])).builder} ${String(
          (await fn(pt.arguments[2])).builder,
        ).replace(/["']/g, '')}))
      END${colAlias}`,
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const datetime_expr1 = (await fn(pt.arguments[0])).builder;
    const datetime_expr2 = (await fn(pt.arguments[1])).builder;

    const unit = convertUnits(
      pt.arguments[2]
        ? (await fn(pt.arguments[2])).builder.bindings[0]
        : 'seconds',
      'mysql',
    );

    if (unit === 'MICROSECOND') {
      // MySQL doesn't support millisecond
      // hence change from MICROSECOND to millisecond manually
      return {
        builder: knex.raw(
          `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) div 1000 ${colAlias}`,
        ),
      };
    }
    return {
      builder: knex.raw(
        `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) ${colAlias}`,
      ),
    };
  },
  WEEKDAY: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(WEEKDAY(${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - ${getWeekdayByText(
          pt?.arguments[1]?.value,
        )} % 7 + 7) % 7 ${colAlias}`,
      ),
    };
  },
};

export default mysql2;
