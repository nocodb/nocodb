import dayjs from 'dayjs';
import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';
import { getWeekdayByText } from '../helpers/formulaFnHelper';

const pg = {
  ...commonFns,
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  ROUND: 'round',
  POWER: 'pow',
  SQRT: 'sqrt',
  SEARCH: (args: MapFnArgs) => {
    return args.knex.raw(
      `POSITION(${args.knex.raw(
        args.fn(args.pt.arguments[1]).toQuery()
      )} in ${args.knex.raw(args.fn(args.pt.arguments[0]).toQuery())})${
        args.colAlias
      }`
    );
  },
  INT(args: MapFnArgs) {
    // todo: correction
    return args.knex.raw(
      `REGEXP_REPLACE(COALESCE(${args.fn(
        args.pt.arguments[0]
      )}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')${args.colAlias}`
    );
  },
  MID: 'SUBSTR',
  FLOAT: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex
      .raw(`CAST(${fn(pt.arguments[0])} as DOUBLE PRECISION)${colAlias}`)
      .wrap('(', ')');
  },
  DATEADD: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    return knex.raw(
      `${fn(pt.arguments[0])} + (${fn(pt.arguments[1])} || 
      '${String(fn(pt.arguments[2])).replace(
        /["']/g,
        ''
      )}')::interval${colAlias}`
    );
  },
  WEEKDAY: ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    // isodow: the day of the week as Monday (1) to Sunday (7)
    // WEEKDAY() returns an index from 0 to 6 for Monday to Sunday
    return knex.raw(
      `(EXTRACT(ISODOW FROM ${
        pt.arguments[0].type === 'Literal'
          ? `date '${dayjs(fn(pt.arguments[0])).format('YYYY-MM-DD')}'`
          : fn(pt.arguments[0])
      }) - 1 - ${getWeekdayByText(
        pt?.arguments[1]?.value
      )} % 7 + 7) % 7 ${colAlias}`
    );
  },
};

export default pg;
