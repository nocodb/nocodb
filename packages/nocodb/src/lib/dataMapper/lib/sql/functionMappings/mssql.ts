import { MapFnArgs } from '../mapFunctionName';
import commonFns from './commonFns';

const mssql = {
  ...commonFns,
  MIN: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\n\tElse ${args.fn(arg).toQuery()}`).toQuery();
      } else {
        query += args.knex
          .raw(
            `\n\tWhen  ${args.pt.arguments
              .filter((_, j) => +i !== j)
              .map(
                arg1 => `${args.fn(arg).toQuery()} < ${args.fn(arg1).toQuery()}`
              )
              .join(' And ')} Then ${args.fn(arg).toQuery()}`
          )
          .toQuery();
      }
    }
    return args.knex.raw(`Case ${query}\n End${args.colAlias}`);
  },
  MAX: (args: MapFnArgs) => {
    if (args.pt.arguments.length === 1) {
      return args.fn(args.pt.arguments[0]);
    }
    let query = '';
    for (const [i, arg] of Object.entries(args.pt.arguments)) {
      if (+i === args.pt.arguments.length - 1) {
        query += args.knex.raw(`\nElse ${args.fn(arg).toQuery()}`).toQuery();
      } else {
        query += args.knex
          .raw(
            `\nWhen  ${args.pt.arguments
              .filter((_, j) => +i !== j)
              .map(
                arg1 => `${args.fn(arg).toQuery()} > ${args.fn(arg1).toQuery()}`
              )
              .join(' And ')} Then ${args.fn(arg).toQuery()}`
          )
          .toQuery();
      }
    }

    return args.knex.raw(`Case ${query}\n End${args.colAlias}`);
  },
  MOD: pt => {
    Object.assign(pt, {
      type: 'BinaryExpression',
      operator: '%',
      left: pt.arguments[0],
      right: pt.arguments[1]
    });
  },
  REPEAT: 'REPLICATE',
  NOW: 'getdate',
  SEARCH: (args: MapFnArgs) => {
    args.pt.callee.name = 'CHARINDEX';
    const temp = args.pt.arguments[0];
    args.pt.arguments[0] = args.pt.arguments[1];
    args.pt.arguments[1] = temp;
  },
  INT: (args: MapFnArgs) => {
    return args.knex.raw(
      `CASE WHEN ISNUMERIC(${args
        .fn(args.pt.arguments[0])
        .toQuery()}) = 1 THEN FLOOR(${args
        .fn(args.pt.arguments[0])
        .toQuery()}) ELSE 0 END${args.colAlias}`
    );
  },
  MID: 'SUBSTR',
  FLOAT: (args: MapFnArgs) => {
    return args.knex
      .raw(`CAST(${args.fn(args.pt.arguments[0])} as FLOAT)${args.colAlias}`)
      .wrap('(', ')');
  }
};

export default mssql;
