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
        `CAST(${(await args.fn(args.pt.arguments[0])).builder} as SIGNED)`,
      ),
    };
  },
  LEFT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?,1,?)`, [source, needle]),
    };
  },
  RIGHT: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    const needle = (await args.fn(args.pt.arguments[1])).builder;
    return {
      builder: args.knex.raw(`SUBSTR(?, -(?))`, [source, needle]),
    };
  },
  MID: 'SUBSTR',
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: args.knex
        .raw(
          `CAST(CAST(${
            (await args.fn(args.pt.arguments[0])).builder
          } as CHAR) AS DOUBLE)`,
        )
        .wrap('(', ')'),
    };
  },
  DATEADD: async ({ fn, knex, pt }: MapFnArgs) => {
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
      END`,
      ),
    };
  },
  DATETIME_DIFF: async ({ fn, knex, pt }: MapFnArgs) => {
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
          `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1}) div 1000`,
        ),
      };
    }
    return {
      builder: knex.raw(
        `TIMESTAMPDIFF(${unit}, ${datetime_expr2}, ${datetime_expr1})`,
      ),
    };
  },
  WEEKDAY: async ({ fn, knex, pt }: MapFnArgs) => {
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return {
      builder: knex.raw(
        `(WEEKDAY(${
          pt.arguments[0].type === 'Literal'
            ? `'${dayjs((await fn(pt.arguments[0])).builder).format(
                'YYYY-MM-DD',
              )}'`
            : (await fn(pt.arguments[0])).builder
        }) - ${getWeekdayByText(pt?.arguments[1]?.value)} % 7 + 7) % 7`,
      ),
    };
  },
  DAY: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(DAY FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  MONTH: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(MONTH FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  YEAR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(YEAR FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  HOUR: async ({ fn, knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(
        `EXTRACT(HOUR FROM ((${(await fn(pt?.arguments[0])).builder}) + 0))`,
      ),
    };
  },
  REGEX_MATCH: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(`(? REGEXP ?)`, [source, pattern]),
    };
  },
  REGEX_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(`REGEXP_SUBSTR(?, ?, 1, 1, 'c')`, [source, pattern]),
    };
  },
  REGEX_REPLACE: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const pattern = (await fn(pt.arguments[1])).builder;
    const replacement = (await fn(pt.arguments[2])).builder;
    return {
      builder: knex.raw(`REGEXP_REPLACE(?, ?, ?, 1, 0, 'c')`, [
        source,
        pattern,
        replacement,
      ]),
    };
  },
  XOR: async ({ fn, knex, pt }: MapFnArgs) => {
    const args = await Promise.all(
      pt.arguments.map(async (arg) => {
        return { builder: (await fn(arg)).builder };
      }),
    );
    const predicates = args.map(() => '?').join(' XOR ');
    return {
      builder: knex.raw(`${predicates}`, args),
    };
  },

  VALUE: async ({ fn, knex, pt }: MapFnArgs) => {
    const value = (await fn(pt.arguments[0])).builder;

    return {
      builder: knex.raw(
        `ROUND(CASE
  WHEN :value IS NULL OR REGEXP_REPLACE(:value, '[^0-9.]+', '') IN ('.', '') OR LENGTH(REGEXP_REPLACE(:value, '[^.]+', '')) > 1 THEN NULL
  WHEN LENGTH(REGEXP_REPLACE(:value, '[^%]', '')) > 0 THEN POW(-1, LENGTH(REGEXP_REPLACE(:value, '[^-]',''))) * (REGEXP_REPLACE(:value, '[^0-9.]+', '')) / 100
  ELSE POW(-1, LENGTH(REGEXP_REPLACE(:value, '[^-]', ''))) * (REGEXP_REPLACE(:value, '[^0-9.]+', ''))
END)`,
        { value },
      ),
    };
  },
  STRING: async (args: MapFnArgs) => {
    const source = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(`CAST(? AS CHAR) `, [source]),
    };
  },
  JSON_EXTRACT: async ({ fn, knex, pt }: MapFnArgs) => {
    const source = (await fn(pt.arguments[0])).builder;
    const needle = (await fn(pt.arguments[1])).builder;
    return {
      builder: knex.raw(
        `CASE WHEN JSON_VALID(:source) = 1 THEN JSON_EXTRACT(:source, CONCAT('$', :needle)) ELSE NULL END`,
        {
          source,
          needle,
        },
      ),
    };
  },
};

export default mysql2;
