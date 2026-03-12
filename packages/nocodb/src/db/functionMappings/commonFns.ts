import { FormulaDataTypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { MapFnArgs } from '~/db/mapFunctionName';
import { concatKnexRaw } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';

export const ALLOWED_DATEADD_UNITS = new Set([
  'day',
  'week',
  'month',
  'year',
  'hour',
  'minute',
  'second',
]);

export function validateDateAddUnit(raw: string): string {
  const unit = raw.replace(/["']/g, '').trim().toLowerCase();
  if (!ALLOWED_DATEADD_UNITS.has(unit)) {
    NcError.badRequest(`Invalid DATEADD unit: ${unit}`);
  }
  return unit;
}

// SQL-level sanitization for dynamic unit values (field references, expressions).
// Returns a CASE expression that constrains the value to valid units at query time.
export function safeDateAddUnitSQL(knex: Knex, unitBuilder: any): Knex.Raw {
  const branches = [...ALLOWED_DATEADD_UNITS]
    .map((u) => `WHEN '${u}' THEN '${u}'`)
    .join(' ');
  return knex.raw(`CASE LOWER(?) ${branches} ELSE 'day' END`, [unitBuilder]);
}

async function treatArgAsConditionalExp(
  args: MapFnArgs,
  argument = args.pt?.arguments?.[0],
) {
  const condArg = (await args.fn(argument)).builder;

  let condStr: string;
  let bindings = {};

  // based on the data type of the argument, we need to handle the condition
  // if string - value is not null and not empty then true
  // if number - value is not null and not 0 then true
  // if boolean - value is not null and not false then true
  // if date - value is not null then true
  switch (argument.dataType as FormulaDataTypes) {
    case FormulaDataTypes.NUMERIC:
      condStr = `(:condArg) IS NOT NULL AND (:condArg) != 0`;
      bindings = { condArg };
      break;
    case FormulaDataTypes.STRING:
      condStr = `(:condArg) IS NOT NULL AND (:condArg) != ''`;
      bindings = { condArg };
      break;
    case FormulaDataTypes.BOOLEAN:
      condStr = `(:condArg) IS NOT NULL AND (:condArg) != false`;
      bindings = { condArg };
      break;
    case FormulaDataTypes.DATE:
      condStr = `(:condArg) IS NOT NULL`;
      bindings = { condArg };
      break;
  }

  if (condStr) {
    return { builder: args.knex.raw(condStr, bindings) };
  } else {
    return { builder: condArg };
  }
}

export default {
  SWITCH: async (args: MapFnArgs) => {
    const count = Math.floor((args.pt.arguments.length - 1) / 2);
    const query: Knex.Raw[] = [];

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

    // Check type mismatch between switch value and WHEN comparison values.
    // Strict-typed DBs (e.g. PG) require matching types in CASE WHEN.
    const switchType = args.pt.arguments[0]?.dataType;
    let hasCompareTypeMismatch = false;
    if (
      switchType &&
      switchType !== FormulaDataTypes.NULL &&
      switchType !== FormulaDataTypes.UNKNOWN
    ) {
      for (let i = 0; i < count; i++) {
        const whenType = args.pt.arguments[i * 2 + 1]?.dataType;
        if (
          whenType &&
          whenType !== switchType &&
          whenType !== FormulaDataTypes.NULL &&
          whenType !== FormulaDataTypes.UNKNOWN
        ) {
          hasCompareTypeMismatch = true;
          break;
        }
      }
    }

    // helper: resolve an AST argument and wrap with a DB-specific text cast.
    // PG: (?)::text, MySQL: CAST(? AS CHAR), SQLite: passthrough.
    // Returns { builder } (not a bare Raw) to avoid async-function thenable
    // unwrapping — knex.Raw implements .then() which would execute the SQL.
    const castToString = async (arg: any) => {
      const { builder } = await args.fn(arg);
      const client = args.knex.clientType();
      if (client === 'pg' || client === 'postgre') {
        return { builder: args.knex.raw(`(?)::text`, [builder]) };
      } else if (
        client === 'mysql' ||
        client === 'mysql2' ||
        client === 'maridb'
      ) {
        return { builder: args.knex.raw(`CAST(? AS CHAR)`, [builder]) };
      }
      return { builder };
    };

    const switchVal = hasCompareTypeMismatch
      ? (await castToString(args.pt.arguments[0])).builder
      : (await args.fn(args.pt.arguments[0])).builder;

    // used it for null value check
    const elseValPrefixes: Knex.Raw[] = [];

    for (let i = 0; i < count; i++) {
      let val;
      // cast to string if the return value types are different
      if (returnArgsType.size > 1) {
        val = (await castToString(args.pt.arguments[i * 2 + 2])).builder;
      } else {
        val = (await args.fn(args.pt.arguments[i * 2 + 2])).builder;
      }

      if (
        args.pt.arguments[i * 2 + 1].type === 'CallExpression' &&
        args.pt.arguments[i * 2 + 1].callee?.name === 'BLANK'
      ) {
        // Use positional bindings to avoid knex named-binding conflicts
        // with PG cast syntax (e.g. ::text contains ':text')
        const isStringType =
          args.pt.arguments[i * 2 + 1].dataType === FormulaDataTypes.STRING;
        elseValPrefixes.push(
          args.knex.raw(
            `\n\tWHEN ? IS NULL ${isStringType ? `OR ? = ''` : ''} THEN ?`,
            isStringType ? [switchVal, switchVal, val] : [switchVal, val],
          ),
        );
      } else if (
        args.pt.arguments[i * 2 + 1].dataType === FormulaDataTypes.NULL
      ) {
        elseValPrefixes.push(
          args.knex.raw(`\n\tWHEN ? IS NULL THEN ?`, [switchVal, val]),
        );
      } else {
        // cast WHEN comparison values to string if types differ
        const whenVal = hasCompareTypeMismatch
          ? (await castToString(args.pt.arguments[i * 2 + 1])).builder
          : (await args.fn(args.pt.arguments[i * 2 + 1])).builder;
        query.push(args.knex.raw(`\n\tWHEN ? THEN ?`, [whenVal, val]));
      }
    }
    const hasRegularWhens = query.length > 0;

    if (args.pt.arguments.length % 2 === 0) {
      let val;
      // cast to string if the return value types are different
      if (returnArgsType.size > 1) {
        val = (
          await castToString(args.pt.arguments[args.pt.arguments.length - 1])
        ).builder;
      } else {
        val = (await args.fn(args.pt.arguments[args.pt.arguments.length - 1]))
          .builder;
      }
      if (elseValPrefixes.length > 0) {
        if (hasRegularWhens) {
          const elseValPrefix = concatKnexRaw(args.knex, elseValPrefixes);
          query.push(
            args.knex.raw(`\n\tELSE (CASE ? ELSE ? END)`, [elseValPrefix, val]),
          );
        } else {
          // All WHEN values were BLANK/NULL — use searched CASE form directly
          query.push(...elseValPrefixes);
          query.push(args.knex.raw(`\n\tELSE ?`, [val]));
        }
      } else {
        query.push(args.knex.raw(`\n\tELSE ?`, [val]));
      }
    } else if (elseValPrefixes.length > 0) {
      if (hasRegularWhens) {
        const elseValPrefix = concatKnexRaw(args.knex, elseValPrefixes);
        query.push(args.knex.raw(`\n\tELSE (CASE ? END)`, [elseValPrefix]));
      } else {
        // All WHEN values were BLANK/NULL — use searched CASE form directly
        query.push(...elseValPrefixes);
      }
    }
    const queryRaw = concatKnexRaw(args.knex, query);
    if (hasRegularWhens) {
      // Simple CASE form: CASE switchVal WHEN ... END
      return {
        builder: args.knex.raw(`CASE ? ?\n END`, [switchVal, queryRaw]),
      };
    } else {
      // Searched CASE form (all WHENs were BLANK/NULL): CASE WHEN ... END
      return {
        builder: args.knex.raw(`CASE ?\n END`, [queryRaw]),
      };
    }
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
      thenArg = (await args.fn(args.pt.arguments[1])).builder;
      elseArg = (await args.fn(args.pt.arguments[2])).builder;
    }

    const queries: Knex.Raw[] = [];
    queries.push(args.knex.raw(`\n\tWHEN ? THEN ?`, [cond, thenArg]));

    if (args.pt.arguments[2]) {
      queries.push(args.knex.raw(`\n\tELSE ?`, [elseArg]));
    }
    const predicates = queries.map(() => '?').join(' ');
    return {
      builder: args.knex.raw(`CASE ${predicates}\n END`, queries),
    };
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
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' AND ',
    );
    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        return {
          builder: (await treatArgAsConditionalExp(args, ar)).builder,
        };
      }),
    );

    return {
      builder: args.knex.raw(
        `(${predicates})`,
        parsedArguments.map((k) => k.builder),
      ),
    };
  },
  OR: async (args: MapFnArgs) => {
    const predicates = (args.pt.arguments.map(() => '?') as string[]).join(
      ' OR ',
    );
    const parsedArguments = await Promise.all(
      args.pt.arguments.map(async (ar) => {
        return {
          builder: (await treatArgAsConditionalExp(args, ar)).builder,
        };
      }),
    );

    return {
      builder: args.knex.raw(
        `(${predicates})`,
        parsedArguments.map((k) => k.builder),
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
        args.prevBinaryOp,
      );
    } else {
      return args.fn(args.pt.arguments[0], args.prevBinaryOp);
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
        `CASE WHEN :query >= 0 THEN CEIL((:query) / 2.0) * 2 \n ELSE FLOOR((:query + 2) / 2.0) * 2 - 2\n END`,
        { query },
      ),
    };
  },
  ODD: async (args: MapFnArgs) => {
    const query = (await args.fn(args.pt.arguments[0])).builder;
    return {
      builder: args.knex.raw(
        `CASE WHEN :query >= 0 THEN CEIL((:query - 1) / 2.0) * 2 + 1 \n ELSE FLOOR((:query + 1) / 2.0) * 2 - 1\n END`,
        { query },
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
        `${(await args.fn({ type: 'Identifier', name: pkCol.id })).builder}`,
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
          (await args.fn({ type: 'Identifier', name: createdAtCol.id })).builder
        }`,
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
          (await args.fn({ type: 'Identifier', name: createdAtCol.id })).builder
        }`,
      ),
    };
  },
  // todo: verify the behaviour of this function
  COUNTALL: async ({ knex, pt }: MapFnArgs) => {
    return {
      builder: knex.raw(`? `, [pt.arguments.length]),
    };
  },
  ROUNDDOWN: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(FLOOR((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))`,
      ),
    };
  },
  ROUNDUP: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);
    let precisionBuilder = knex.raw('0');
    if (pt.arguments[1]) {
      const { builder } = await fn(pt.arguments[1]);
      precisionBuilder = builder;
    }

    return {
      builder: knex.raw(
        `(CEIL((${valueBuilder}) * POWER(10, ${precisionBuilder})) / POWER(10, ${precisionBuilder}))`,
      ),
    };
  },
  ISBLANK: async ({ fn, knex, pt }: MapFnArgs) => {
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
      builder: knex.raw(`(? IS NULL OR ? = '')`, [
        valueBuilder,
        stringValueBuilder,
      ]),
    };
  },
  ISNULL: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(`(? IS NULL)`, [valueBuilder]),
    };
  },
  ISNOTBLANK: async ({ fn, knex, pt }: MapFnArgs) => {
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
        `(${valueBuilder} IS NOT NULL AND ${stringValueBuilder} != '')`,
      ),
    };
  },
  ISNOTNULL: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(`(${valueBuilder} IS NOT NULL)`),
    };
  },
  URLENCODE: async ({ fn, knex, pt }: MapFnArgs) => {
    const specialCharacters = '% :/?#[]@$&+,;=';
    let str = (await fn(pt.arguments[0])).builder;
    // Pass the characters as bound parameters to avoid problems with ? sign.
    for (const c of specialCharacters) {
      str = `REPLACE(${str}, ?, '${encodeURIComponent(c)}')`;
    }
    return {
      builder: knex.raw(`${str} `, specialCharacters.split('')),
    };
  },
};
