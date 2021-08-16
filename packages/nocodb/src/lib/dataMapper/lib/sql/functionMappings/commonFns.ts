import {MapFnArgs} from "../mapFunctionName";

export default {
  // todo: handle default case
  SWITCH: (args: MapFnArgs) => {
    const count = Math.floor((args.pt.arguments.length-1) / 2)
    let query = '';

    const switchVal = args.fn(args.pt.arguments[0]).toQuery();

    for (let i = 0; i < count; i++) {
      query += args.knex.raw(`\n\tWHEN ${args.fn(args.pt.arguments[i * 2 + 1]).toQuery()} THEN ${args.fn(args.pt.arguments[i * 2 + 2]).toQuery()}`).toQuery()
    }
    if (args.pt.arguments.length % 2 === 0) {
      query += args.knex.raw(`\n\tELSE ${args.fn(args.pt.arguments[args.pt.arguments.length - 1]).toQuery()}`).toQuery()
    }
    return args.knex.raw(`CASE ${switchVal} ${query}\n END${args.colAlias}`)
  },
  IF: (args: MapFnArgs) => {
    let query = args.knex.raw(`\n\tWHEN ${args.fn(args.pt.arguments[0]).toQuery()} THEN ${args.fn(args.pt.arguments[1]).toQuery()}`).toQuery();
    if (args.pt.arguments[2]) {
      query += args.knex.raw(`\n\tELSE ${args.fn(args.pt.arguments[2]).toQuery()}`).toQuery()
    }
    return args.knex.raw(`CASE ${query}\n END${args.colAlias}`)
  },
  TRUE:(_args) => 1,
  FALSE:(_args) => 0
}
