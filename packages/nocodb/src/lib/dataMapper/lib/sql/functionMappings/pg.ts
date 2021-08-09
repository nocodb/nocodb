import {MapFnArgs} from "../mapFunctionName";

const pg = {
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  ROUND: 'round',
  POWER: 'pow',
  SQRT: 'sqrt',
  SEARCH: (args: MapFnArgs) => {
    return args.knex.raw(`POSITION(${args.knex.raw(args.fn(args.pt.arguments[1]).toQuery())} in ${args.knex.raw(args.fn(args.pt.arguments[0]).toQuery())})${args.colAlias}`)
  },
  INT(args: MapFnArgs) {
    // todo: correction
    return args.knex.raw(`REGEXP_REPLACE(COALESCE(${args.fn(args.pt.arguments[0])}::character varying, '0'), '[^0-9]+|\\.[0-9]+' ,'')${args.colAlias}`)
  }
}


export default pg;
