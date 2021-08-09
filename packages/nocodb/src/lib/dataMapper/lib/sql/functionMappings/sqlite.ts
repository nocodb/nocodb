import {MapFnArgs} from "../mapFunctionName";


const sqlite3 = {
  LEN: 'LENGTH',
  CEILING(_pt) {
    // todo:
  }, FLOOR(_pt) {
    // todo:
  },
  MOD:(pt) => {
    Object.assign(pt, {
      type: 'BinaryExpression',
      operator: '%',
      left: pt.arguments[0],
      right: pt.arguments[1]
    })
  },
  REPEAT(args: MapFnArgs) {
    return args.knex.raw(`replace(printf('%.' || ${args.fn(args.pt.arguments[1])} || 'c', '/'),'/',${args.fn(args.pt.arguments[0])})${args.colAlias}`)
  },
  NOW: 'DATE',
  SEARCH:'INSTR',
  INT(args: MapFnArgs) {
    return args.knex.raw(`CAST(${args.fn(args.pt.arguments[0])} as INTEGER)${args.colAlias}`)
  }
}


export default sqlite3;
