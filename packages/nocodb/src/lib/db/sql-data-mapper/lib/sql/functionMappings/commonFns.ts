import type { MapFnArgs } from '../mapFunctionName';

export default {
  // todo: handle default case
  SWITCH: (args: MapFnArgs) => {
    const count = Math.floor((args.pt.arguments.length - 1) / 2);
    let query = '';

    const switchVal = args.fn(args.pt.arguments[0]).toQuery();

    for (let i = 0; i < count; i++) {
      query += args.knex
        .raw(
          `\n\tWHEN ${args
            .fn(args.pt.arguments[i * 2 + 1])
            .toQuery()} THEN ${args.fn(args.pt.arguments[i * 2 + 2]).toQuery()}`
        )
        .toQuery();
    }
    if (args.pt.arguments.length % 2 === 0) {
      query += args.knex
        .raw(
          `\n\tELSE ${args
            .fn(args.pt.arguments[args.pt.arguments.length - 1])
            .toQuery()}`
        )
        .toQuery();
    }
    return args.knex.raw(`CASE ${switchVal} ${query}\n END${args.colAlias}`);
  },
  IF: (args: MapFnArgs) => {
    let query = args.knex
      .raw(
        `\n\tWHEN ${args.fn(args.pt.arguments[0]).toQuery()} THEN ${args
          .fn(args.pt.arguments[1])
          .toQuery()}`
      )
      .toQuery();
    if (args.pt.arguments[2]) {
      query += args.knex
        .raw(`\n\tELSE ${args.fn(args.pt.arguments[2]).toQuery()}`)
        .toQuery();
    }
    return args.knex.raw(`CASE ${query}\n END${args.colAlias}`);
  },
  TRUE: (_args) => 1,
  FALSE: (_args) => 0,
  AND: (args: MapFnArgs) => {
    return args.knex.raw(
      `${args.knex
        .raw(
          `${args.pt.arguments
            .map((ar) => args.fn(ar).toQuery())
            .join(' AND ')}`
        )
        .wrap('(', ')')
        .toQuery()}${args.colAlias}`
    );
  },
  OR: (args: MapFnArgs) => {
    return args.knex.raw(
      `${args.knex
        .raw(
          `${args.pt.arguments.map((ar) => args.fn(ar).toQuery()).join(' OR ')}`
        )
        .wrap('(', ')')
        .toQuery()}${args.colAlias}`
    );
  },
  AVG: (args: MapFnArgs) => {
    if (args.pt.arguments.length > 1) {
      return args.fn(
        {
          type: 'BinaryExpression',
          operator: '/',
          left: { ...args.pt, callee: { name: 'SUM' } },
          right: { type: 'Literal', value: args.pt.arguments.length },
        },
        args.a,
        args.prevBinaryOp
      );
    } else {
      return args.fn(args.pt.arguments[0], args.a, args.prevBinaryOp);
    }
  },
  FLOAT: (args: MapFnArgs) => {
    return args.fn(args.pt?.arguments?.[0]).wrap('(', ')');
  },
};
