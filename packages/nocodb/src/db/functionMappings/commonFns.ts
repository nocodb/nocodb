import {
  FormulaDataTypes,
  isBtLikeV2Junction,
  JSEPNode,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { MapFnArgs } from '~/db/mapFunctionName';
import type { Column, FormulaColumn, Model, RollupColumn } from '~/models';
import { concatKnexRaw } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/catchError';
import { DEFAULT_DATETIME_FORMAT } from '~/db/datetime-format';
import { escapeBindingPlaceholders } from '~/helpers/sqlSanitize';
import {
  isBooleanFormulaType,
  pgBooleanAsNumberSql,
} from '~/db/formulav2/formula-query-builder.helpers';

// For SQL assembled by hand into a bindingless `knex.raw`: an outer `toQuery()`
// fills every `?` with the next binding, even inside a string literal, so a
// user-supplied `?` would pull a later bound value out of its quotes.
export function escapePlaceholders(sql: string): string {
  return sql.replace(/\?/g, '\\?');
}

// Reads the (optional) format argument of DATETIME_FORMAT. The format must be a
// constant string literal so it can be translated to a SQL pattern at build
// time; a missing argument falls back to the default format.
export function extractDatetimeFormat(pt: MapFnArgs['pt']): string {
  const formatArg = pt?.arguments?.[1];

  if (!formatArg) {
    return DEFAULT_DATETIME_FORMAT;
  }

  if (
    formatArg.type !== JSEPNode.LITERAL ||
    typeof formatArg.value !== 'string'
  ) {
    NcError.badRequest(
      'Second parameter of DATETIME_FORMAT must be a constant text format',
    );
  }

  return formatArg.value;
}

const NUMERIC_COLUMN_UIDTS = new Set<string>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Duration,
  UITypes.Links,
]);

// pg prints money per the database's `lc_monetary`, so the text path would
// depend on the server locale — cast through NUMERIC, which is exact.
const isMoneyColumn = (column: Column) => column?.dt?.toLowerCase() === 'money';

// float4 → float8 exposes the binary error (0.1 → 0.10000000149011612);
// the text path reads the printed 0.1
const isFloat4Column = (column: Column) =>
  ['real', 'float4', 'float'].includes(column?.dt?.toLowerCase());

/** How a VALUE() argument should be cast; `false` = parse it as text. */
export type ValueArgKind = false | 'float' | 'money';

/**
 * Whether a VALUE() argument is numeric SQL, and how to cast it. Judged by the
 * columns as they are now: a stored parse tree may predate a referenced
 * field's type change.
 */
export async function isNumericValueArg(
  arg: MapFnArgs['pt'],
  model: Model,
): Promise<ValueArgKind> {
  if (arg?.dataType !== FormulaDataTypes.NUMERIC || arg.isDataArray) {
    return false;
  }

  const columns = model.columns?.length
    ? model.columns
    : await model.getColumns();

  const columnById = (id: string) => columns.find((c) => c.id === id);

  // formulas on the current reference path — stops a cycle, not a repeat
  const visitedFormulas = new Set<string>();
  // finished results, so a repeated reference isn't walked again
  const formulaKinds = new Map<string, ValueArgKind>();

  const columnKind = async (column: Column): Promise<ValueArgKind> => {
    if (!column) return false;
    if (isMoneyColumn(column)) return 'money';
    if (isFloat4Column(column)) return false;

    if (column.uidt === UITypes.Links) {
      // a single-record V2 link reads the related record's display value
      await column.getColOptions().catch(() => null);
      return isBtLikeV2Junction(column) ? false : 'float';
    }

    if (NUMERIC_COLUMN_UIDTS.has(column.uidt)) return 'float';

    if (column.uidt === UITypes.Formula) {
      if (formulaKinds.has(column.id)) return formulaKinds.get(column.id);
      if (visitedFormulas.has(column.id)) return false;
      visitedFormulas.add(column.id);
      try {
        const formula = (column.colOptions ??
          (await column.getColOptions().catch(() => null))) as FormulaColumn;

        // no stored tree = it was cleared by a field change; parse as text
        const kind = await nodeKind(formula?.getParsedTree?.());
        formulaKinds.set(column.id, kind);
        return kind;
      } finally {
        visitedFormulas.delete(column.id);
      }
    }

    if (column.uidt !== UITypes.Rollup) return false;
    if (!rollupKinds.has(column.id)) {
      rollupKinds.set(column.id, rollupKind(column));
    }
    return rollupKinds.get(column.id);
  };

  // each lookup of the rollup target is a cache read
  const rollupKinds = new Map<string, Promise<ValueArgKind>>();
  const rollupKind = async (column: Column): Promise<ValueArgKind> => {
    const rollup = (column.colOptions ??
      (await column.getColOptions().catch(() => null))) as RollupColumn;
    if (!rollup) return false;

    // count variants return an integer whatever the target field is
    if (rollup.rollup_function?.startsWith('count')) return 'float';

    const target = await rollup.getRollupColumn().catch(() => null);
    // sum/min/max of a float4 stay float4
    if (isFloat4Column(target)) return false;
    // sum/avg/min/max of money stay money
    if (isMoneyColumn(target)) return 'money';
    // min/max return the target field's type
    if (!['min', 'max'].includes(rollup.rollup_function)) return 'float';
    return NUMERIC_COLUMN_UIDTS.has(target?.uidt) ? 'float' : false;
  };

  // Every field a node reads is still plain-numeric — a function's own SQL is
  // numeric when its tree says so, but the tree may be out of date.
  const readsOnlyFloatColumns = async (node: unknown): Promise<boolean> => {
    if (!node || typeof node !== 'object') return true;

    if (Array.isArray(node)) {
      for (const child of node) {
        if (!(await readsOnlyFloatColumns(child))) return false;
      }
      return true;
    }

    const typed = node as MapFnArgs['pt'];
    if (typed.type === JSEPNode.IDENTIFIER) {
      return (await columnKind(columnById(typed.name))) === 'float';
    }

    // a call's `callee` is an Identifier holding the function name, not a field
    if (typed.type === JSEPNode.CALL_EXP) {
      return readsOnlyFloatColumns(typed.arguments);
    }

    for (const value of Object.values(node)) {
      if (!(await readsOnlyFloatColumns(value))) return false;
    }
    return true;
  };

  async function nodeKind(node: MapFnArgs['pt']): Promise<ValueArgKind> {
    switch (node?.type) {
      case JSEPNode.LITERAL:
        return typeof node.value === 'number' ? 'float' : false;
      case JSEPNode.IDENTIFIER:
        return columnKind(columnById(node.name));
      case JSEPNode.UNARY_EXP:
        return ['-', '+'].includes(node.operator)
          ? nodeKind(node.argument)
          : false;
      case JSEPNode.BINARY_EXP: {
        if (!['+', '-', '*', '/'].includes(node.operator)) return false;

        const left = await nodeKind(node.left);
        if (!left) return false;
        const right = await nodeKind(node.right);
        if (!right) return false;

        if (left === 'money' || right === 'money') {
          // only division can turn money into an IEEE Infinity, which pg < 14
          // cannot cast to NUMERIC — leave that one to the text path
          return node.operator === '/' ? false : 'money';
        }
        return 'float';
      }
      case JSEPNode.CALL_EXP:
        // pg prints a float8 in exponent form past 1e15 and below 1e-4, which
        // the text path would misread (`1e-05` parses as -105).
        return node.dataType === FormulaDataTypes.NUMERIC &&
          !node.isDataArray &&
          (await readsOnlyFloatColumns(node))
          ? 'float'
          : false;
      default:
        return false;
    }
  }

  return nodeKind(arg);
}

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

function logicalScalarSql(knex: MapFnArgs['knex'], predicates: string): string {
  return ['mssql', 'oracledb'].includes(knex.clientType())
    ? `CASE WHEN (${predicates}) THEN 1 ELSE 0 END`
    : `(${predicates})`;
}

// T-SQL and pre-23ai Oracle have no boolean type: a bare predicate can't be
// selected or tested with `IS NOT NULL AND … != 0`, so materialize it to 1/0.
function predicateScalarSql(
  knex: MapFnArgs['knex'],
  predicate: string,
): string {
  return ['mssql', 'oracledb'].includes(knex.clientType())
    ? `(CASE WHEN ${predicate} THEN 1 ELSE 0 END)`
    : predicate;
}

// Oracle: CONCAT / REPEAT lower a string to CLOB while literals and most scalar
// string ops stay VARCHAR2. A CASE (IF / SWITCH) can't mix the two in its result
// branches — ORA-00932 ("expression is of data type CLOB, which is incompatible
// with expected data type CHAR"), since Oracle infers the CASE type from the
// first branch and CLOB can't implicitly narrow to VARCHAR2. When at least one
// branch is already a CLOB, wrap the other (VARCHAR2/NUMBER) branches in TO_CLOB
// so every branch shares the CLOB type (TO_CLOB is identity on a CLOB). A CASE
// with no CLOB branch is left untouched, so its result stays a plain VARCHAR2 —
// keeping formula filters / sorts comparable.
function unifyOracleClobCaseBranches(
  knex: MapFnArgs['knex'],
  branches: Array<Knex.Raw | undefined>,
): Array<Knex.Raw | undefined> {
  const producesClob = (b: Knex.Raw | undefined) =>
    b != null && /\bto_clob\s*\(/i.test(b.toString());
  if (!branches.some(producesClob)) return branches;
  return branches.map((b) =>
    b == null || producesClob(b) ? b : knex.raw('TO_CLOB(?)', [b]),
  );
}

export async function treatArgAsConditionalExp(
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
      // Oracle treats '' as NULL — the != '' arm is never true there (and
      // is illegal on CLOBs), so IS NOT NULL alone is the equivalent check.
      condStr =
        args.knex.clientType() === 'oracledb'
          ? `(:condArg) IS NOT NULL`
          : `(:condArg) IS NOT NULL AND (:condArg) != ''`;
      bindings = { condArg };
      break;
    case FormulaDataTypes.BOOLEAN: {
      // T-SQL and Oracle have no `false` literal; use 0 (matches bit /
      // number(1) columns and the 1/0 CASE materialization).
      const falseLit = ['mssql', 'oracledb'].includes(args.knex.clientType())
        ? '0'
        : 'false';
      condStr = `(:condArg) IS NOT NULL AND (:condArg) != ${falseLit}`;
      bindings = { condArg };
      break;
    }
    case FormulaDataTypes.DATE:
      condStr = `(:condArg) IS NOT NULL`;
      bindings = { condArg };
      break;
    case FormulaDataTypes.COND_EXP: {
      // A comparison expression (`x > 0`, `a = b`, …). On MSSQL the binary
      // builder materializes a top-level comparison into a `1/0` int (T-SQL
      // has no boolean type), so it can't be used bare as a `CASE WHEN <int>`
      // predicate — "An expression of non-boolean type ... near 'THEN'".
      // Coerce it back to a boolean predicate with `<> 0`. Logical combos
      // (AND/OR) stay native boolean predicates and pg/sqlite keep the bare
      // comparison, both already valid in a CASE WHEN — so leave those as-is.
      const isComparison =
        argument?.type === 'BinaryExpression' &&
        ['==', '=', '<', '>', '<=', '>=', '!='].includes(
          (argument as { operator?: string }).operator,
        );
      if (args.knex.clientType() === 'mssql' && isComparison) {
        condStr = `(:condArg) <> 0`;
        bindings = { condArg };
      }
      break;
    }
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
    const isNumericLike = (type?: string) =>
      type === FormulaDataTypes.NUMERIC || isBooleanFormulaType(type);
    // pg: compare booleans and numbers as 1/0, not as text, where 'true' never
    // equals '1'. A BLANK case keeps the old path.
    const boolSwitchAsNumber =
      args.knex.clientType() === 'pg' &&
      isNumericLike(switchType) &&
      Array.from(
        { length: count },
        (_, i) => args.pt.arguments[i * 2 + 1],
      ).every((arg) => isNumericLike(arg?.dataType));
    const resolveAsNumber = async (arg: any) => {
      const { builder } = await args.fn(arg);
      return isBooleanFormulaType(arg?.dataType)
        ? { builder: args.knex.raw(pgBooleanAsNumberSql('?'), [builder]) }
        : { builder };
    };
    let hasCompareTypeMismatch = false;
    if (
      !boolSwitchAsNumber &&
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
    // PG: (?)::text, MySQL: CAST(? AS CHAR), MSSQL: CAST(? AS NVARCHAR(MAX)),
    // SQLite: passthrough.
    // Returns { builder } (not a bare Raw) to avoid async-function thenable
    // unwrapping — knex.Raw implements .then() which would execute the SQL.
    const castToString = async (arg: any) => {
      const { builder } = await args.fn(arg);
      const client = args.knex.clientType();
      if (client === 'pg' || client === 'postgres') {
        return { builder: args.knex.raw(`(?)::text`, [builder]) };
      } else if (
        client === 'mysql' ||
        client === 'mysql2' ||
        client === 'maridb'
      ) {
        return { builder: args.knex.raw(`CAST(? AS CHAR)`, [builder]) };
      } else if (client === 'mssql') {
        return {
          builder: args.knex.raw(`CAST(? AS NVARCHAR(MAX))`, [builder]),
        };
      } else if (client === 'oracledb') {
        return {
          builder: args.knex.raw(`TO_CHAR(?)`, [builder]),
        };
      }
      return { builder };
    };

    const switchVal = boolSwitchAsNumber
      ? (await resolveAsNumber(args.pt.arguments[0])).builder
      : hasCompareTypeMismatch
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
        const whenVal = boolSwitchAsNumber
          ? (await resolveAsNumber(args.pt.arguments[i * 2 + 1])).builder
          : hasCompareTypeMismatch
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
    // the else branch is optional: `IF(cond, value)`
    const hasElse = !!args.pt.arguments[2];
    const returnArgsType = new Set(
      [args.pt.arguments[1].dataType, args.pt.arguments[2]?.dataType].filter(
        (type) => type && type !== FormulaDataTypes.NULL,
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
      if (hasElse) elseArg = (await args.fn(args.pt.arguments[2])).builder;
    }

    // Oracle: keep the THEN / ELSE result branches type-consistent so a CLOB
    // branch (e.g. CONCAT) and a VARCHAR2 literal don't collide in the CASE.
    if (hasElse && args.knex.clientType() === 'oracledb') {
      [thenArg, elseArg] = unifyOracleClobCaseBranches(args.knex, [
        thenArg,
        elseArg,
      ]);
    }

    const queries: Knex.Raw[] = [];
    queries.push(args.knex.raw(`\n\tWHEN ? THEN ?`, [cond, thenArg]));

    if (hasElse) {
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
        logicalScalarSql(args.knex, predicates),
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
        logicalScalarSql(args.knex, predicates),
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
      builder: knex.raw(predicateScalarSql(knex, `(? IS NULL OR ? = '')`), [
        valueBuilder,
        stringValueBuilder,
      ]),
    };
  },
  ISNULL: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(predicateScalarSql(knex, `(? IS NULL)`), [
        valueBuilder,
      ]),
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
        predicateScalarSql(
          knex,
          `(${valueBuilder} IS NOT NULL AND ${stringValueBuilder} != '')`,
        ),
      ),
    };
  },
  ISNOTNULL: async ({ fn, knex, pt }: MapFnArgs) => {
    const { builder: valueBuilder } = await fn(pt.arguments[0]);

    return {
      builder: knex.raw(
        predicateScalarSql(knex, `(${valueBuilder} IS NOT NULL)`),
      ),
    };
  },
  URLENCODE: async ({ fn, knex, pt }: MapFnArgs) => {
    const specialCharacters = '% :/?#[]@$&+,;=';
    // The rendered source is followed by real bindings, so its own `?` must not count.
    let str = escapeBindingPlaceholders(
      `${(await fn(pt.arguments[0])).builder}`,
    );
    // Pass the characters as bound parameters to avoid problems with ? sign.
    for (const c of specialCharacters) {
      str = `REPLACE(${str}, ?, '${encodeURIComponent(c)}')`;
    }
    return {
      builder: knex.raw(`${str} `, specialCharacters.split('')),
    };
  },
};
