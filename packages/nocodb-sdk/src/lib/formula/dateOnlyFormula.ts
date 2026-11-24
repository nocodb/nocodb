import UITypes from '../UITypes';
import { FormulaDataTypes, JSEPNode } from './enums';
import type { IdentifierNode, ParsedFormulaNode } from './types';

const DATE_ONLY_DATEADD_UNITS = ['day', 'week', 'month', 'year'];

/**
 * Whether a DATE expression never carries a time of day: a date-only leaf,
 * DATEADD of one by a whole count of days/weeks/months/years, or IF/SWITCH
 * whose results are all such (or BLANK). Formulas and rollup formulas differ
 * only in their leaves and integer check.
 */
export function isDateOnlyExpression(
  node: ParsedFormulaNode | undefined,
  isDateOnlyLeaf: (node: ParsedFormulaNode) => boolean,
  isInteger: (node?: ParsedFormulaNode) => boolean
): boolean {
  if (!node) return false;
  if (node.type !== JSEPNode.CALL_EXP) return isDateOnlyLeaf(node);
  const walk = (n?: ParsedFormulaNode) =>
    isDateOnlyExpression(n, isDateOnlyLeaf, isInteger);
  const callee = node.callee?.name?.toUpperCase();
  const args = node.arguments ?? [];
  switch (callee) {
    case 'DATEADD': {
      const [date, count, unit] = args;
      // DATEADD lowercases its unit
      return (
        walk(date) &&
        isInteger(count) &&
        unit?.type === JSEPNode.LITERAL &&
        typeof unit.value === 'string' &&
        DATE_ONLY_DATEADD_UNITS.includes(unit.value.trim().toLowerCase())
      );
    }
    case 'IF':
    case 'SWITCH': {
      const rest = args.slice(1);
      // SWITCH(expr, pattern, result, …, [default])
      const results =
        callee === 'IF'
          ? rest
          : rest.filter((_, i) => i % 2 === 1 || i === rest.length - 1);
      const isBlank = (n: ParsedFormulaNode) =>
        n.type === JSEPNode.CALL_EXP &&
        n.callee?.name?.toUpperCase() === 'BLANK';
      return (
        results.some((n) => !isBlank(n)) &&
        results.every((n) => isBlank(n) || walk(n))
      );
    }
  }
  return isDateOnlyLeaf(node);
}

// via another formula, referencedColumn is that formula's source, not the formula
const isOwnField = (node: IdentifierNode, uidt: UITypes) =>
  !node.isDataArray &&
  node.referencedColumn?.uidt === uidt &&
  (node.referencedColumn.id === node.name ||
    (uidt === UITypes.Date && !!node.referencedColumn.dateOnly));

const isIntegerFormula = (node?: ParsedFormulaNode): boolean =>
  node?.type === JSEPNode.LITERAL
    ? Number.isInteger(node.value)
    : node?.type === JSEPNode.UNARY_EXP
    ? ['-', '+'].includes(node.operator) && isIntegerFormula(node.argument)
    : node?.type === JSEPNode.IDENTIFIER && isOwnField(node, UITypes.Number);

/**
 * Whether a DATE formula never carries a time of day: a Date field, TODAY(),
 * WORKDAY(), DATEADD of one by whole days/weeks/months/years, or IF/SWITCH
 * over those. It then filters as a Date, by its own day in any timezone.
 */
export function isDateOnlyFormula(node?: ParsedFormulaNode): boolean {
  return isDateOnlyExpression(
    node,
    (leaf) =>
      leaf.type === JSEPNode.IDENTIFIER
        ? isOwnField(leaf, UITypes.Date)
        : leaf.type === JSEPNode.CALL_EXP &&
          ['TODAY', 'WORKDAY'].includes(leaf.callee?.name?.toUpperCase()),
    isIntegerFormula
  );
}

/** The date type a DATE formula filters as: Date when it is date-only. */
export const formulaDateUidt = (
  parsedTree?: ParsedFormulaNode
): UITypes.Date | UITypes.DateTime | undefined =>
  parsedTree?.dataType !== FormulaDataTypes.DATE
    ? undefined
    : isDateOnlyFormula(parsedTree)
    ? UITypes.Date
    : UITypes.DateTime;

/**
 * True only for expressions known to be a datetime instant. Date fields and
 * anything unidentified are not shifted (a Date would move to another day).
 * `storedOnly`: a UTC instant only (a stored one or parsed text), not NOW(),
 * for a dialect whose NOW() is already local.
 */
export function isDatetimeInstantNode(
  node: ParsedFormulaNode | undefined,
  storedOnly = false
): boolean {
  const recurse = (n: ParsedFormulaNode) =>
    isDatetimeInstantNode(n, storedOnly);
  if (node?.dataType !== FormulaDataTypes.DATE) return false;

  if (node.type === JSEPNode.IDENTIFIER) {
    const ref = (node as IdentifierNode).referencedColumn;
    // another formula: classified by its own expression
    if (ref?.instant)
      return ref.instant === 'stored' || (!storedOnly && ref.instant === 'any');
    // read at call time: UITypes and this module import each other
    return [
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(ref?.uidt as UITypes);
  }

  if (node.type !== JSEPNode.CALL_EXP) return false;

  const args: ParsedFormulaNode[] = node.arguments ?? [];
  // result branches that can carry the value
  let branches: ParsedFormulaNode[];
  switch (node.callee?.name?.toUpperCase()) {
    case 'NOW':
      return !storedOnly;
    case 'CREATED_TIME':
      return true;
    // parsed text is an instant; a date argument passes through unchanged
    case 'DATETIME_PARSE':
      return args[0]?.dataType === FormulaDataTypes.DATE
        ? recurse(args[0])
        : true;
    // SQLite's DATEADD returns UTC, so even DATEADD(NOW()) is a UTC instant
    case 'DATEADD':
      return isDatetimeInstantNode(args[0]);
    case 'IF':
      branches = args.slice(1, 3);
      break;
    case 'SWITCH':
      branches = args.filter(
        (_, i) => (i > 0 && i % 2 === 0) || (i === args.length - 1 && i > 0)
      );
      break;
    default:
      return false;
  }

  const valueBranches = branches.filter(
    (b) => b && b.dataType !== FormulaDataTypes.NULL
  );
  return valueBranches.length > 0 && valueBranches.every(recurse);
}

/** How a formula's value is an instant, for formulas that reference it. */
export const formulaInstantKind = (
  parsedTree?: ParsedFormulaNode
): 'stored' | 'any' | 'none' =>
  isDatetimeInstantNode(parsedTree, true)
    ? 'stored'
    : isDatetimeInstantNode(parsedTree)
    ? 'any'
    : 'none';
