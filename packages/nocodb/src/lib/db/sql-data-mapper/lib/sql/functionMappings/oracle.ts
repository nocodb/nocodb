import commonFns from './commonFns';
import { MapFnArgs } from '../mapFunctionName';

const pg = {
  ...commonFns,
  LEN: 'LENGTH',
  MIN: 'LEAST',
  MAX: 'GREATEST',
  CEILING: 'CEIL',
  POWER: 'POWER',
  SQRT: 'SQRT',
  SEARCH: 'INSTR',
  MID: 'SUBSTR',
  NOW: (args: MapFnArgs) => {
    return args.knex.raw(`CURRENT_DATE${args.colAlias}`);
  },
  REPEAT: (args: MapFnArgs) => {
    const arg1 = args.fn(args.pt.arguments[0]).toQuery();
    const arg2 = args.fn(args.pt.arguments[1]).toQuery();
    return args.knex.raw(
      `RPAD(${arg1}, ${arg2}*LENGTH(${arg1}), ${arg1})${args.colAlias}`
    );
  },
  INT: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN TRIM(TRANSLATE(${args
        .fn(args.pt.arguments[0])
        .toQuery()}, '0123456789-,.', ' ')) is null
      THEN FLOOR(TO_NUMBER(${args
        .fn(args.pt.arguments[0])
        .toQuery()})) ELSE 0 END${args.colAlias}`
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
      `SUBSTR(${args.fn(args.pt.arguments[0])},-1 * ${args.fn(
        args.pt.arguments[1]
      )})${args.colAlias}`
    );
  },
  DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `CASE
      WHEN ${fn(pt.arguments[2])} = 'year' THEN ADD_MONTHS(${fn(
        pt.arguments[0]
      ).toQuery()},12 * ${fn(pt.arguments[1])})
      WHEN ${fn(pt.arguments[2])} = 'month' THEN ADD_MONTHS(${fn(
        pt.arguments[0]
      ).toQuery()},${fn(pt.arguments[1])})
      WHEN ${fn(pt.arguments[2])} = 'day' THEN ${fn(
        pt.arguments[0]
      ).toQuery()} + ${fn(pt.arguments[1])}
      WHEN ${fn(pt.arguments[2])} = 'week' THEN ${fn(
        pt.arguments[0]
      ).toQuery()} + 7 * ${fn(pt.arguments[1])}
      END${colAlias}`
    );
  },
  // WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
  //   // isodow: the day of the week as Monday (1) to Sunday (7)
  //   // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
  //   return knex.raw(
  //     `(EXTRACT(ISODOW FROM ${
  //       pt.arguments[0].type === 'Literal'
  //         ? `date '${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
  //         : fn(pt.arguments[0])
  //     }) - 1 - ${getWeekdayByText(
  //       pt?.arguments[1]?.value
  //     )} % 7 + 7) ::INTEGER % 7 ${colAlias}`
  //   );
  // },
};

export default pg;
