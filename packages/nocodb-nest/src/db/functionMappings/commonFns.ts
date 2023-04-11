import type { MapFnArgs } from '../mapFunctionName';

export default {
  // todo: handle default case
  SWITCH: async (args: MapFnArgs) => {
    const count = Math.floor((args.pt.arguments.length - 1) / 2);
    let query = '';

    const switchVal = (await args.fn(args.pt.arguments[0])).builder.toQuery();

    for (let i = 0; i < count; i++) {
      query += args.knex
        .raw(
          `\n\tWHEN ${(
            await args.fn(args.pt.arguments[i * 2 + 1])
          ).builder.toQuery()} THEN ${(
            await args.fn(args.pt.arguments[i * 2 + 2])
          ).builder.toQuery()}`,
        )
        .toQuery();
    }
    if (args.pt.arguments.length % 2 === 0) {
      query += args.knex
        .raw(
          `\n\tELSE ${(
            await args.fn(args.pt.arguments[args.pt.arguments.length - 1])
          ).builder.toQuery()}`,
        )
        .toQuery();
    }
    return {
      builder: args.knex.raw(
        `CASE ${switchVal} ${query}\n END${args.colAlias}`,
      ),
    };
  },
  IF: async (args: MapFnArgs) => {
    let query = args.knex
      .raw(
        `\n\tWHEN ${(
          await args.fn(args.pt.arguments[0])
        ).builder.toQuery()} THEN ${(
          await args.fn(args.pt.arguments[1])
        ).builder.toQuery()}`,
      )
      .toQuery();
    if (args.pt.arguments[2]) {
      query += args.knex
        .raw(
          `\n\tELSE ${(await args.fn(args.pt.arguments[2])).builder.toQuery()}`,
        )
        .toQuery();
    }
    return { builder: args.knex.raw(`CASE ${query}\n END${args.colAlias}`) };
  },
  TRUE: 1,
  FALSE: 0,
  AND: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar)).builder.toQuery(),
                ),
              )
            ).join(' AND ')}`,
          )
          .wrap('(', ')')
          .toQuery()}${args.colAlias}`,
      ),
    };
  },
  OR: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await args.fn(ar)).builder.toQuery(),
                ),
              )
            ).join(' OR ')}`,
          )
          .wrap('(', ')')
          .toQuery()}${args.colAlias}`,
      ),
    };
  },
  AVG: async (args: MapFnArgs) => {
    if (args.pt.arguments.length > 1) {
      return args.fn(
        {
          type: 'BinaryExpression',
          operator: '/',
          left: { ...args.pt, callee: { name: 'SUM' } },
          right: { type: 'Literal', value: args.pt.arguments.length },
        },
        args.a,
        args.prevBinaryOp,
      );
    } else {
      return args.fn(args.pt.arguments[0], args.a, args.prevBinaryOp);
    }
  },
  FLOAT: async (args: MapFnArgs) => {
    return {
      builder: (await args.fn(args.pt?.arguments?.[0])).builder.wrap('(', ')'),
    };
  },
};
