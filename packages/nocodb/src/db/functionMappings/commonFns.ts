import type { MapFnArgs } from '../mapFunctionName';
import { NcError } from '~/helpers/catchError';

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
  BLANK: async (args: MapFnArgs) => {
    return { builder: args.knex.raw(`?`, [null]) };
  },
  TRUE: async (args: MapFnArgs) => {
    return { builder: args.knex.raw(`?`, [1]) };
  },
  FALSE: async (args: MapFnArgs) => {
    return { builder: args.knex.raw(`?`, [0]) };
  },
  EVEN: async (args: MapFnArgs) => {
    const query = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN ${query} % 2 = 0 THEN CEIL(${query})\nELSE CEIL(${query} / 2.0) * 2\n END${args.colAlias}`,
      ),
    };
  },
  ODD: async (args: MapFnArgs) => {
    const query = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN ${query} >= 0 THEN CEIL((${query} - 1) / 2.0) * 2 + 1 \n ELSE FLOOR((${query} + 1) / 2.0) * 2 - 1\n END${args.colAlias}`,
      ),
    };
  },
  RECORD_ID: async (args: MapFnArgs) => {
    const pkCol = args.model?.primaryKey;
    if (!pkCol) {
      NcError.badRequest('Primary key not found');
    }

    return {
      builder: args.knex.raw(
        `${
          (await args.fn({ type: 'Identifier', name: pkCol.id }, args.a))
            .builder
        } ${args.colAlias}`,
      ),
    };
  },
  CREATED_TIME: async (args: MapFnArgs) => {
    const createdAtCol = args.model?.columns?.find(
      (col) => col.column_name === 'created_at',
    );
    if (!createdAtCol) {
      NcError.badRequest('Created at field not found');
    }

    return {
      builder: args.knex.raw(
        `${
          (await args.fn({ type: 'Identifier', name: createdAtCol.id }, args.a))
            .builder
        } ${args.colAlias}`,
      ),
    };
  },
  LAST_MODIFIED_TIME: async (args: MapFnArgs) => {
    const createdAtCol = args.model?.columns?.find(
      (col) => col.column_name === 'updated_at',
    );
    if (!createdAtCol) {
      NcError.badRequest('Updated at field not found');
    }

    return {
      builder: args.knex.raw(
        `${
          (await args.fn({ type: 'Identifier', name: createdAtCol.id }, args.a))
            .builder
        } ${args.colAlias}`,
      ),
    };
  },
  // todo: verify the behaviour of this function
  COUNTALL: async ({ knex, pt, colAlias }: MapFnArgs) => {
    return {
      builder: knex.raw(`? ${colAlias}`, [pt.arguments.length]),
    };
  },
  ROUNDDOWN: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `ROUND(FLOOR((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))${colAlias}`,
      ),
    };
  },
  ROUNDUP: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `ROUND(CEIL((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))${colAlias}`,
      ),
    };
  },
};
