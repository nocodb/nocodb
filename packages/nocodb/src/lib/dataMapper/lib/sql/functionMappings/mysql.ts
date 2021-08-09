import {MapFnArgs} from "../mapFunctionName";


const mysql2 = {
  LEN: 'CHAR_LENGTH',
  MIN: 'LEAST',
  MAX: 'GREATEST',
  SEARCH: (args: MapFnArgs) => {
    args.pt.callee.name = 'LOCATE';
    const temp = args.pt.arguments[0]
    args.pt.arguments[0] = args.pt.arguments[1]
    args.pt.arguments[1] = temp;
  },
  INT:(args: MapFnArgs) =>{
    return args.knex.raw(`CAST(${args.fn(args.pt.arguments[0])} as SIGNED)${args.colAlias}`)
  },
  LEFT:(args: MapFnArgs)=> {
    return args.knex.raw(`SUBSTR(${args.fn(args.pt.arguments[0])},1,${args.fn(args.pt.arguments[1])})${args.colAlias}`)
  },
  RIGHT:(args: MapFnArgs)=> {
    return args.knex.raw(`SUBSTR(${args.fn(args.pt.arguments[0])},-${args.fn(args.pt.arguments[1])})${args.colAlias}`)
  }
}


export default mysql2;

