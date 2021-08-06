import {XKnex} from "../../index";

interface MapFnArgs {
  pt: any,
  aliasToCol: { [alias: string]: string },
  knex: XKnex,
  alias: string,
  fn: (...args: any) => any
}

const MOD = (pt) => {
  Object.assign(pt, {
    type: 'BinaryExpression',
    operator: '%',
    left: pt.arguments[0],
    right: pt.arguments[1]
  })
}
const mysql2 = {
  LEN: 'CHAR_LENGTH',
  MIN: 'LEAST',
  MAX: 'GREATEST',
}

const pg = {
  LEN: 'length',
  MIN: 'least',
  MAX: 'greatest',
  CEILING: 'ceil',
  ROUND: 'round',
  POWER: 'pow',
  SQRT: 'sqrt'
}

const mssql = {
  MIN: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0])
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\n\tElse ${args.fn(arg).toQuery()}`).toQuery()
      } else {
        query += args.knex.raw(`\n\tWhen  ${args.pt.arguments.filter((_, j) => +i !== j).map(arg1 => `${args.fn(arg).toQuery()} < ${args.fn(arg1).toQuery()}`).join(' And ')} Then ${args.fn(arg).toQuery()}`).toQuery()
      }
    }

    return args.knex.raw(`Case ${query}\n End as ${args.alias}`)
  },
  MAX: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0])
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\nElse ${args.fn(arg).toQuery()}`).toQuery()
      } else {
        query += args.knex.raw(`\nWhen  ${args.pt.arguments.filter((_, j) => +i !== j).map(arg1 => `${args.fn(arg).toQuery()} > ${args.fn(arg1).toQuery()}`).join(' And ')} Then ${args.fn(arg).toQuery()}`).toQuery()
      }
    }

    return args.knex.raw(`Case ${query}\n End as ${args.alias}`)
  },
  MOD,
  REPEAT: 'REPLICATE',
  NOW: 'getdate'
}


const sqlite3 = {
  LEN: 'LENGTH',
  CEILING(_pt) {
    // todo:
  }, FLOOR(_pt) {
    // todo:
  },
  MOD,
  REPEAT(args: MapFnArgs) {
    return args.knex.raw(`replace(printf('%.' || ${args.fn(args.pt.arguments[1])} || 'c', '/'),'/',${args.fn(args.pt.arguments[0])}) ${args.alias}`)
  },
  NOW: 'DATE'
}


const mapFunctionName = (args: MapFnArgs): any => {
  const name = args.pt.callee.name;
  let val;
  switch (args.knex.clientType()) {
    case 'mysql':
    case 'mysql2':
      val = mysql2[name] || name;
      break;
    case 'pg':
    case 'postgre':
      val = pg[name] || name;
      break;
    case 'mssql':
      val = mssql[name] || name;
      break;
    case 'sqlite':
    case 'sqlite3':
      val = sqlite3[name] || name;
      break;
  }

  if (typeof val === 'function') {
    return val(args)
  } else if (typeof val === 'string') {
    args.pt.callee.name = val;
  }
}


export default mapFunctionName;