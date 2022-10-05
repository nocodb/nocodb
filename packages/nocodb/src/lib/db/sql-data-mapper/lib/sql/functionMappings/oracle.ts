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
  NOW: (args: MapFnArgs) => {
    return args.knex.raw(`CURRENT_DATE${args.colAlias}`);
  },
  REPEAT: (args: MapFnArgs) => {
    const arg1 = args.fn(args.pt.arguments[0]);
    const arg2 = args.fn(args.pt.arguments[1]);
    return args.knex.raw(
      `RPAD(${arg1}, ${arg2}*LENGTH(${arg1}), ${arg1})${args.colAlias}`
    );
  },
  // INT(args: MapFnArgs) {
  //   // todo: correction
  //   return args.knex.raw(
  //     `REGEXP_REPLACE(COALESCE(${args.fn(
  //       args.pt.arguments[0]
  //     )}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')${args.colAlias}`
  //   );
  // },
  // MID: 'SUBSTR',
  // FLOAT: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
  //   return knex
  //     .raw(`CAST(${fn(pt.arguments[0])} as DOUBLE PRECISION)${colAlias}`)
  //     .wrap('(', ')');
  // },
  // DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
  //   return knex.raw(
  //     `${fn(pt.arguments[0])} + (${fn(pt.arguments[1])} ||
  //     '${String(fn(pt.arguments[2])).replace(
  //       /["']/g,
  //       ''
  //     )}')::interval${colAlias}`
  //   );
  // },
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
