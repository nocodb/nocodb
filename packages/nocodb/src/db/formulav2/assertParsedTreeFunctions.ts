import {
  ArithmeticOperators,
  ComparisonOperators,
  formulas,
  JSEPNode,
  StringOperators,
} from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { getMappedFunctionNames } from '~/db/mapFunctionName';

// A BinaryExpression's `operator` is interpolated verbatim into `knex.raw`
// (parsed-tree-builder.ts: `${left} ${pt.operator} ${right}`) and is never
// revalidated on a reused stored tree. The builder only ever *compares* it
// against known operators, so a poisoned tree carrying
// `operator: "; DROP ... --"` reaches raw SQL (GHSA-frqc, one field over from
// the callee-name sink). Assert it against the exhaustive canonical set the
// SDK defines for binary expressions.
const ALLOWED_OPERATORS: ReadonlySet<string> = new Set<string>([
  ...StringOperators,
  ...ArithmeticOperators,
  ...ComparisonOperators,
]);

// A saved formula's parsed_tree is produced by `validateFormulaAndExtractTreeWithType`,
// which rejects any call whose function name is not in `formulas`
// (validate-extract-tree.ts). But `formulaQueryBuilderv2` reuses a STORED
// parsed_tree without revalidating, and the builder later interpolates the
// function name unbound into `knex.raw` (parsed-tree-builder.ts). So a tree
// poisoned via a metadata write (GHSA-frqc) reaches raw SQL with an
// attacker-chosen function name.
//
// Re-assert the name whitelist on a reused tree, before the builder walks it.
// The saved tree is the builder's OUTPUT, not the raw user formula: a prior
// build rewrites call names to their dialect target IN PLACE and persists that
// tree (MIN→least, LEN→length/char_length, CEILING→ceil, MAX→greatest, mysql
// SEARCH→locate), and wraps `/` operands in FLOAT() and mixed-type `==` operands
// in STRING(). So the legitimate set is the user-facing `formulas` PLUS every
// dialect rewrite target the builder can emit (from `getMappedFunctionNames`) —
// checking `formulas` alone rejects legitimately-saved trees. Lazy so the
// function-mapping modules (which import sibling formulav2 modules) finish
// loading before we read them.
let allowedFunctionNames: Set<string> | null = null;

function getAllowedFunctionNames(): Set<string> {
  if (allowedFunctionNames) return allowedFunctionNames;

  const set = new Set<string>(getMappedFunctionNames());
  for (const name of Object.keys(formulas)) {
    set.add(name.toUpperCase());
  }

  allowedFunctionNames = set;
  return set;
}

export function assertParsedTreeFunctions(node: unknown): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) assertParsedTreeFunctions(child);
    return;
  }

  const record = node as Record<string, any>;

  if (
    record.type === JSEPNode.CALL_EXP &&
    typeof record.callee?.name === 'string'
  ) {
    const calleeName = record.callee.name.toUpperCase();
    if (!getAllowedFunctionNames().has(calleeName)) {
      NcError.formulaError(`Function ${calleeName} is not available`);
    }
  }

  if (
    record.type === JSEPNode.BINARY_EXP &&
    typeof record.operator === 'string' &&
    !ALLOWED_OPERATORS.has(record.operator)
  ) {
    NcError.formulaError(`Operator ${record.operator} is not available`);
  }

  for (const key of Object.keys(record)) {
    assertParsedTreeFunctions(record[key]);
  }
}
