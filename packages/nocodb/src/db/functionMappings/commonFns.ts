import { FormulaDataTypes } from 'nocodb-sdk';
import type { MapFnArgs } from '../mapFunctionName';
import { NcError } from '~/helpers/catchError';

async function treatArgAsConditionalExp(
  args: MapFnArgs,
  argument = args.pt?.arguments?.[0],
) {
  const condArg = (await args.fn(argument)).builder.toQuery();

  let cond = condArg;

  // based on the data type of the argument, we need to handle the condition
  // if string - value is not null and not empty then true
  // if number - value is not null and not 0 then true
  // if boolean - value is not null and not false then true
  // if date - value is not null then true
  switch (argument.dataType as FormulaDataTypes) {
    case FormulaDataTypes.NUMERIC:
      cond = `(${condArg}) IS NOT NULL AND (${condArg}) != 0`;
      break;
    case FormulaDataTypes.STRING:
      cond = `(${condArg}) IS NOT NULL AND (${condArg}) != ''`;
      break;
    case FormulaDataTypes.BOOLEAN:
      cond = `(${condArg}) IS NOT NULL AND (${condArg}) != false`;
      break;
    case FormulaDataTypes.DATE:
      cond = `(${condArg}) IS NOT NULL`;
      break;
  }
  return { builder: args.knex.raw(cond) };
}

export default {
  SWITCH: async (args: MapFnArgs) => {
    const count = Math.floor((args.pt.arguments.length - 1) / 2);
    let query = '';

    const returnArgsType = new Set(
      args.pt.arguments
        .filter(
          (type, i) => i > 1 && i % 2 === 0 && type !== FormulaDataTypes.NULL,
        )
        .map((type) => type.dataType),
    );

    // if else case present then push that to types
    if (args.pt.arguments.length % 2 === 0) {
      returnArgsType.add(
        args.pt.arguments[args.pt.arguments.length - 1].dataType,
      );
    }

    const switchVal = (await args.fn(args.pt.arguments[0])).builder.toQuery();

    // used it for null value check
    let elseValPrefix = '';

    for (let i = 0; i < count; i++) {
      let val;
      // cast to string if the return value types are different
      if (returnArgsType.size > 1) {
        val = (
          await args.fn({
            type: 'CallExpression',
            arguments: [args.pt.arguments[i * 2 + 2]],
            callee: {
              type: 'Identifier',
              name: 'STRING',
            },
          } as any)
        ).builder.toQuery();
      } else {
        val = (await args.fn(args.pt.arguments[i * 2 + 2])).builder.toQuery();
      }

      if (
        args.pt.arguments[i * 2 + 1].type === 'CallExpression' &&
        args.pt.arguments[i * 2 + 1].callee?.name === 'BLANK'
      ) {
        elseValPrefix += args.knex
          .raw(
            `\n\tWHEN ${switchVal} IS NULL ${
              args.pt.arguments[i * 2 + 1].dataType === FormulaDataTypes.STRING
                ? `OR ${switchVal} = ''`
                : ''
            } THEN ${val}`,
          )
          .toQuery();
      } else if (
        args.pt.arguments[i * 2 + 1].dataType === FormulaDataTypes.NULL
      ) {
        elseValPrefix += args.knex
          .raw(`\n\tWHEN ${switchVal} IS NULL THEN ${val}`)
          .toQuery();
      } else {
        query += args.knex
          .raw(
            `\n\tWHEN ${(
              await args.fn(args.pt.arguments[i * 2 + 1])
            ).builder.toQuery()} THEN ${val}`,
          )
          .toQuery();
      }
    }
    if (args.pt.arguments.length % 2 === 0) {
      let val;
      // cast to string if the return value types are different
      if (returnArgsType.size > 1) {
        val = (
          await args.fn({
            type: 'CallExpression',
            arguments: [args.pt.arguments[args.pt.arguments.length - 1]],
            callee: {
              type: 'Identifier',
              name: 'STRING',
            },
          } as any)
        ).builder.toQuery();
      } else {
        val = (
          await args.fn(args.pt.arguments[args.pt.arguments.length - 1])
        ).builder.toQuery();
      }
      if (elseValPrefix) {
        query += `\n\tELSE (CASE ${elseValPrefix} ELSE ${val} END)`;
      } else {
        query += `\n\tELSE ${val}`;
      }
    } else if (elseValPrefix) {
      query += `\n\tELSE (CASE ${elseValPrefix} END)`;
    }
    return {
      builder: args.knex.raw(
        `CASE ${switchVal} ${query}\n END${args.colAlias}`,
      ),
    };
  },
  IF: async (args: MapFnArgs) => {
    const cond = (await treatArgAsConditionalExp(args)).builder;
    let thenArg;
    let elseArg;
    const returnArgsType = new Set(
      [args.pt.arguments[1].dataType, args.pt.arguments[2].dataType].filter(
        (type) => type !== FormulaDataTypes.NULL,
      ),
    );
    // cast to string if the return value types are different
    if (returnArgsType.size > 1) {
      thenArg = (
        await args.fn({
          type: 'CallExpression',
          arguments: [args.pt.arguments[1]],
          callee: {
            type: 'Identifier',
            name: 'STRING',
          },
        } as any)
      ).builder;
      elseArg = (
        await args.fn({
          type: 'CallExpression',
          arguments: [args.pt.arguments[2]],
          callee: {
            type: 'Identifier',
            name: 'STRING',
          },
        } as any)
      ).builder;
    } else {
      thenArg = (await args.fn(args.pt.arguments[1])).builder.toQuery();
      elseArg = (await args.fn(args.pt.arguments[2])).builder.toQuery();
    }

    let query = args.knex.raw(`\n\tWHEN ${cond} THEN ${thenArg}`).toQuery();
    if (args.pt.arguments[2]) {
      query += args.knex.raw(`\n\tELSE ${elseArg}`).toQuery();
    }
    return { builder: args.knex.raw(`CASE ${query}\n END${args.colAlias}`) };
  },
  // used only for casting to string internally, this one is dummy function
  // and will work as fallback for dbs which don't support/implemented CAST
  STRING(args: MapFnArgs) {
    return args.fn(args.pt?.arguments?.[0]);
  },
  BOOLEAN(args: MapFnArgs) {
    return args.fn(args.pt?.arguments?.[0]);
  },
  AND: async (args: MapFnArgs) => {
    return {
      builder: args.knex.raw(
        `${args.knex
          .raw(
            `${(
              await Promise.all(
                args.pt.arguments.map(async (ar) =>
                  (await treatArgAsConditionalExp(args, ar)).builder.toQuery(),
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
                  (await treatArgAsConditionalExp(args, ar)).builder.toQuery(),
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
        `CASE WHEN ${query} >= 0 THEN CEIL((${query}) / 2.0) * 2 \n ELSE FLOOR((${query} + 2) / 2.0) * 2 - 2\n END${args.colAlias}`,
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
        `(FLOOR((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))${colAlias}`,
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
        `(CEIL((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))${colAlias}`,
      ),
    };
  },
  ISBLANK: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    const { builder: stringValueBuilder } = await fn({
      type: 'CallExpression',
      arguments: [pt.arguments[0]],
      callee: {
        type: 'Identifier',
        name: 'STRING',
      },
    });

    return {
      builder: knex.raw(
        `(${valueBuilder} IS NULL OR ${stringValueBuilder} = '')${colAlias}`,
      ),
    };
  },
  ISNULL: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(`(${valueBuilder} IS NULL)${colAlias}`),
    };
  },
  ISNOTBLANK: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    const { builder: stringValueBuilder } = await fn({
      type: 'CallExpression',
      arguments: [pt.arguments[0]],
      callee: {
        type: 'Identifier',
        name: 'STRING',
      },
    });
    return {
      builder: knex.raw(
        `(${valueBuilder} IS NOT NULL AND ${stringValueBuilder} != '')${colAlias}`,
      ),
    };
  },
  ISNOTNULL: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(`(${valueBuilder} IS NOT NULL)${colAlias}`),
    };
  },
  URLENCODE: async ({ fn, knex, pt, colAlias }: MapFnArgs) => {
    const specialCharacters = '% :/?#[]@$&+,;=';
    let str = (await fn(pt.arguments[0])).builder;
    // Pass the characters as bound parameters to avoid problems with ? sign.
    for (const c of specialCharacters) {
      str = `REPLACE(${str}, ?, '${encodeURIComponent(c)}')`;
    }
    return {
      builder: knex.raw(`${str} ${colAlias}`, specialCharacters.split('')),
    };
  },
};
