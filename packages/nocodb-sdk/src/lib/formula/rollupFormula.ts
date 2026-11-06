import UITypes from '../UITypes';
import { FormulaDataTypes, JSEPNode } from './enums';
import type {
  CallExpressionNode,
  FormulaMeta,
  ParsedFormulaNode,
} from './types';
import type { RollupType } from '~/lib/Api';

/** `rollup_function` value of a rollup whose aggregation is a formula over `values` */
export const ROLLUP_FORMULA_FUNCTION = 'formula';

/** Identifier a rollup formula uses for the linked records' values */
export const ROLLUP_VALUES_KEYWORD = 'values';
// each aggregate is a correlated subquery per row read
export const MAX_ROLLUP_AGGREGATES = 50;

export enum RollupAggregate {
  SUM = 'SUM',
  AVERAGE = 'AVERAGE',
  MIN = 'MIN',
  MAX = 'MAX',
  COUNT = 'COUNT',
  COUNTA = 'COUNTA',
  COUNTALL = 'COUNTALL',
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  CONCATENATE = 'CONCATENATE',
  ARRAYJOIN = 'ARRAYJOIN',
}

export enum RollupModifier {
  ARRAYUNIQUE = 'ARRAYUNIQUE',
  ARRAYCOMPACT = 'ARRAYCOMPACT',
  ARRAYSLICE = 'ARRAYSLICE',
  ARRAYFLATTEN = 'ARRAYFLATTEN',
}

const AGGREGATES_BY_NAME = new Map<string, RollupAggregate>([
  ...Object.values(RollupAggregate).map(
    (aggregate): [string, RollupAggregate] => [aggregate, aggregate]
  ),
  ['AVG', RollupAggregate.AVERAGE],
  ['CONCAT', RollupAggregate.CONCATENATE],
]);

const MODIFIERS_BY_NAME = new Map<string, RollupModifier>(
  Object.values(RollupModifier).map((modifier): [string, RollupModifier] => [
    modifier,
    modifier,
  ])
);

export const ROLLUP_ARRAYJOIN_DEFAULT_SEPARATOR = ', ';

// also scalar formula functions: in a per-value expression (inside an
// aggregate, where `values` is one value) they call the scalar function
const SCALAR_AGGREGATE_NAMES: readonly string[] = [
  'AND',
  'OR',
  'XOR',
  'MIN',
  'MAX',
  'CONCAT',
  'CONCATENATE',
];

/** Plain formula function an aggregate name means when it does not aggregate */
export const ROLLUP_SCALAR_ALIASES: Readonly<Record<string, string>> = {
  CONCATENATE: 'CONCAT',
};

export function getRollupAggregate(
  name: string,
  inValueExpression = false
): RollupAggregate | undefined {
  const upper = name?.toUpperCase();
  if (!upper) return undefined;
  if (inValueExpression && SCALAR_AGGREGATE_NAMES.includes(upper))
    return undefined;
  return AGGREGATES_BY_NAME.get(upper);
}

export function getRollupModifier(name: string): RollupModifier | undefined {
  return MODIFIERS_BY_NAME.get(name?.toUpperCase());
}

/**
 * Narrows the `colOptions` of a column already known to be a rollup: the
 * options union is untagged, and every RollupType field is optional.
 */
export function isRollupColOptions(
  colOptions: unknown
): colOptions is RollupType {
  return typeof colOptions === 'object' && colOptions !== null;
}

export const isRollupFormula = (colOptions?: {
  rollup_function?: string;
}): boolean => colOptions?.rollup_function === ROLLUP_FORMULA_FUNCTION;

/**
 * Whether `node` references `values` outside any aggregate. An aggregate call
 * binds the `values` inside it, so `MIN(SUM(values), 10)` has no free values
 * (MIN is a plain function there) while `MIN(values)` does (MIN aggregates).
 * In a per-value expression MIN / AND … are scalar and bind nothing.
 */
export function hasFreeRollupValues(
  node: ParsedFormulaNode,
  inValueExpression = false
): boolean {
  if (!node) return false;
  const hasFree = (n: ParsedFormulaNode) =>
    hasFreeRollupValues(n, inValueExpression);
  switch (node.type) {
    case JSEPNode.IDENTIFIER:
      return node.name === ROLLUP_VALUES_KEYWORD;
    case JSEPNode.CALL_EXP:
      if (getRollupAggregate(node.callee?.name, inValueExpression))
        return false;
      return node.arguments?.some(hasFree) ?? false;
    case JSEPNode.BINARY_EXP:
      return hasFree(node.left) || hasFree(node.right);
    case JSEPNode.UNARY_EXP:
      return hasFree(node.argument);
    default:
      return false;
  }
}

/** Calls in a validated rollup formula tree that aggregate over `values` */
export function extractRollupAggregates(
  node: ParsedFormulaNode
): CallExpressionNode[] {
  const result: CallExpressionNode[] = [];
  const walk = (n: ParsedFormulaNode) => {
    if (!n) return;
    if (n.type === JSEPNode.CALL_EXP) {
      if (n.rollupAggregate) {
        result.push(n);
        return;
      }
      n.arguments?.forEach(walk);
    } else if (n.type === JSEPNode.BINARY_EXP) {
      walk(n.left);
      walk(n.right);
    } else if (n.type === JSEPNode.UNARY_EXP) {
      walk(n.argument);
    }
  };
  walk(node);
  return result;
}

/**
 * An aggregate whose value keeps the rolled-up field's type and formatting:
 * a bare `SUM(values)` over a currency field renders as currency.
 */
export function rollupFormulaKeepsTargetFormat(
  parsedTree?: ParsedFormulaNode
): boolean {
  if (parsedTree?.type !== JSEPNode.CALL_EXP || !parsedTree.rollupAggregate)
    return false;
  if (
    ![
      RollupAggregate.SUM,
      RollupAggregate.AVERAGE,
      RollupAggregate.MIN,
      RollupAggregate.MAX,
    ].includes(parsedTree.rollupAggregate)
  )
    return false;
  // the bare `values` (through modifiers), not a per-value expression
  let arg: ParsedFormulaNode = parsedTree.arguments?.[0];
  while (arg?.type === JSEPNode.CALL_EXP && arg.rollupModifier) {
    arg = arg.arguments?.[0];
  }
  return (
    arg?.type === JSEPNode.IDENTIFIER && arg.name === ROLLUP_VALUES_KEYWORD
  );
}

// a function, not a module constant: helperFunctions imports this file and
// UITypes imports helperFunctions, so UITypes can be unset at load time
const integerTargetTypes = (): string[] => [
  UITypes.Number,
  UITypes.Links,
  UITypes.Rating,
  UITypes.AutoNumber,
  UITypes.Year,
  UITypes.Count,
];

const integerLiteral = (node?: ParsedFormulaNode): number | undefined => {
  const value =
    node?.type === JSEPNode.LITERAL
      ? node.value
      : node?.type === JSEPNode.UNARY_EXP &&
        node.operator === '-' &&
        node.argument?.type === JSEPNode.LITERAL &&
        typeof node.argument.value === 'number'
      ? -node.argument.value
      : undefined;
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : undefined;
};

const ROUND_FUNCTIONS: readonly string[] = ['ROUND', 'ROUNDDOWN', 'ROUNDUP'];

/** Decimal places a root ROUND / ROUNDDOWN / ROUNDUP with literal digits rounds to */
export function getRollupFormulaRoundDigits(
  parsedTree?: ParsedFormulaNode
): number | undefined {
  if (
    parsedTree?.type !== JSEPNode.CALL_EXP ||
    !ROUND_FUNCTIONS.includes(parsedTree.callee?.name?.toUpperCase())
  )
    return undefined;
  const digits = parsedTree.arguments?.[1];
  // ROUND(x) rounds to a whole number
  return digits ? integerLiteral(digits) : 0;
}

/** Decimal places a formula rollup shows while its field sets no precision */
export function getRollupFormulaDefaultPrecision(
  parsedTree?: ParsedFormulaNode
): number {
  if (rollupFormulaResultUidt(parsedTree) !== UITypes.Decimal) return 0;
  return getRollupFormulaRoundDigits(parsedTree) ?? 2;
}

/** Whether every value of a numeric rollup formula result is a whole number */
export function isIntegerRollupFormula(
  parsedTree?: ParsedFormulaNode
): boolean {
  switch (parsedTree?.type) {
    case JSEPNode.LITERAL:
    case JSEPNode.UNARY_EXP:
      if (integerLiteral(parsedTree) !== undefined) return true;
      return (
        parsedTree.type === JSEPNode.UNARY_EXP &&
        parsedTree.operator === '-' &&
        isIntegerRollupFormula(parsedTree.argument)
      );
    case JSEPNode.BINARY_EXP:
      return (
        ['+', '-', '*'].includes(parsedTree.operator) &&
        isIntegerRollupFormula(parsedTree.left) &&
        isIntegerRollupFormula(parsedTree.right)
      );
    case JSEPNode.CALL_EXP:
      break;
    default:
      return false;
  }
  const roundDigits = getRollupFormulaRoundDigits(parsedTree);
  if (roundDigits !== undefined && roundDigits <= 0) return true;
  const aggregate = parsedTree.rollupAggregate;
  if (
    [
      RollupAggregate.COUNT,
      RollupAggregate.COUNTA,
      RollupAggregate.COUNTALL,
    ].includes(aggregate)
  )
    return true;
  // MIN / MAX over text is always 0
  if (
    [RollupAggregate.MIN, RollupAggregate.MAX].includes(aggregate) &&
    parsedTree.arguments?.[0]?.dataType === FormulaDataTypes.STRING
  )
    return true;
  // SUM / MIN / MAX of a whole-number field stays whole
  return (
    [RollupAggregate.SUM, RollupAggregate.MIN, RollupAggregate.MAX].includes(
      aggregate
    ) &&
    rollupFormulaKeepsTargetFormat(parsedTree) &&
    integerTargetTypes().includes(parsedTree.referencedColumn?.uidt)
  );
}

/**
 * The field type a rollup's result behaves as, for filters, aggregations,
 * sorting and display:
 * 1. a formula rollup takes its formula's result type;
 * 2. `min`/`max` over a date field takes that date type (`result_uidt`,
 *    resolved from the target on read);
 * 3. anything else is a number — undefined, and the rollup's own numeric
 *    handling applies.
 * Undefined for any column that is not a rollup.
 */
export function getRollupResultUidt(column?: {
  uidt?: string;
  colOptions?: unknown;
}): UITypes | undefined {
  const colOptions = column?.colOptions;
  if (column?.uidt !== UITypes.Rollup || !isRollupColOptions(colOptions))
    return undefined;
  if (isRollupFormula(colOptions)) {
    return rollupFormulaResultUidt(colOptions.parsed_tree);
  }
  if (colOptions.result_uidt === UITypes.Date) return UITypes.Date;
  if (colOptions.result_uidt === UITypes.DateTime) return UITypes.DateTime;
  return undefined;
}

const DATE_ONLY_DATEADD_UNITS: readonly unknown[] = [
  'day',
  'week',
  'month',
  'year',
];

/**
 * MIN / MAX of a Date field, optionally moved by DATEADD in whole days,
 * weeks, months or years, or chosen by IF / SWITCH: never carries a time of day.
 */
function isDateOnlyRollupFormula(node?: ParsedFormulaNode): boolean {
  if (node?.type !== JSEPNode.CALL_EXP) return false;
  if (node.rollupAggregate) {
    return (
      [RollupAggregate.MIN, RollupAggregate.MAX].includes(
        node.rollupAggregate
      ) &&
      rollupFormulaKeepsTargetFormat(node) &&
      node.referencedColumn?.uidt === UITypes.Date
    );
  }
  const callee = node.callee?.name?.toUpperCase();
  if (callee === 'IF' || callee === 'SWITCH') {
    const rest = node.arguments?.slice(1) ?? [];
    // SWITCH(expr, pattern, result, …, [default])
    const results =
      callee === 'IF'
        ? rest
        : rest.filter((_, i) => i % 2 === 1 || i === rest.length - 1);
    const isBlank = (n: ParsedFormulaNode) =>
      n.type === JSEPNode.CALL_EXP && n.callee?.name?.toUpperCase() === 'BLANK';
    return (
      results.some((n) => !isBlank(n)) &&
      results.every((n) => isBlank(n) || isDateOnlyRollupFormula(n))
    );
  }
  if (callee !== 'DATEADD') return false;
  const [date, count, unit] = node.arguments ?? [];
  return (
    isDateOnlyRollupFormula(date) &&
    isIntegerRollupFormula(count) &&
    unit?.type === JSEPNode.LITERAL &&
    DATE_ONLY_DATEADD_UNITS.includes(unit.value)
  );
}

/** Field type a rollup formula result behaves as for filters, aggregations and display */
export function rollupFormulaResultUidt(
  parsedTree?: ParsedFormulaNode
): UITypes {
  switch (parsedTree?.dataType) {
    case FormulaDataTypes.NUMERIC:
      return isIntegerRollupFormula(parsedTree)
        ? UITypes.Number
        : UITypes.Decimal;
    case FormulaDataTypes.DATE:
      // a date-only result stays a date (no time, no timezone)
      return isDateOnlyRollupFormula(parsedTree)
        ? UITypes.Date
        : UITypes.DateTime;
    case FormulaDataTypes.BOOLEAN:
    case FormulaDataTypes.COND_EXP:
      return UITypes.Checkbox;
    case FormulaDataTypes.INTERVAL:
      return UITypes.Time;
    default:
      return UITypes.SingleLineText;
  }
}

const ROLLUP_DOCS =
  'https://nocodb.com/docs/product-docs/fields/field-types/links-based/rollup';

/** Reference shown by the rollup formula editor */
export const rollupFormulaFunctions: Record<
  RollupAggregate | RollupModifier,
  FormulaMeta
> = {
  [RollupAggregate.SUM]: {
    description: 'Sum of the values. Blank when no record is linked: 0',
    syntax: 'SUM(values)',
    examples: ['SUM(values)', 'SUM(values * 1.1)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.AVERAGE]: {
    description: 'Average of the values (AVG also works)',
    syntax: 'AVERAGE(values)',
    examples: ['AVERAGE(values)', 'ROUND(AVERAGE(values), 2)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.MIN]: {
    description: 'Smallest value — numbers, dates or text',
    syntax: 'MIN(values)',
    examples: ['MIN(values)'],
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.MAX]: {
    description: 'Largest value — numbers, dates or text',
    syntax: 'MAX(values)',
    examples: ['MAX(values)', 'MAX(values) - MIN(values)'],
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.COUNT]: {
    description:
      'Number of numeric values (ticked checkboxes count; text and dates do not)',
    syntax: 'COUNT(values)',
    examples: ['COUNT(values)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.COUNTA]: {
    description: 'Number of values that are neither blank nor empty text',
    syntax: 'COUNTA(values)',
    examples: ['COUNTA(values)'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.COUNTALL]: {
    description: 'Number of linked records, blanks included',
    syntax: 'COUNTALL(values)',
    examples: ['COUNTALL(values)', 'COUNTALL(ARRAYUNIQUE(values))'],
    returnType: FormulaDataTypes.NUMERIC,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.AND]: {
    description:
      'True when every value is truthy (also when nothing is linked)',
    syntax: 'AND(values)',
    examples: ['AND(values)', 'AND(values > 0)'],
    returnType: FormulaDataTypes.BOOLEAN,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.OR]: {
    description: 'True when at least one value is truthy',
    syntax: 'OR(values)',
    examples: ['OR(values)', 'OR(values = "Blocked")'],
    returnType: FormulaDataTypes.BOOLEAN,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.XOR]: {
    description: 'True when an odd number of values are truthy',
    syntax: 'XOR(values)',
    examples: ['XOR(values)'],
    returnType: FormulaDataTypes.BOOLEAN,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.CONCATENATE]: {
    description: 'Joins the values into one text with no separator',
    syntax: 'CONCATENATE(values)',
    examples: ['CONCATENATE(values)'],
    returnType: FormulaDataTypes.STRING,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupAggregate.ARRAYJOIN]: {
    description: 'Joins the values with a separator (default ", ")',
    syntax: 'ARRAYJOIN(values, [separator])',
    examples: ['ARRAYJOIN(values)', 'ARRAYJOIN(ARRAYUNIQUE(values), "; ")'],
    returnType: FormulaDataTypes.STRING,
    docsUrl: ROLLUP_DOCS,
  },
  [RollupModifier.ARRAYUNIQUE]: {
    description: 'Keeps each distinct value once',
    syntax: 'ARRAYUNIQUE(values)',
    examples: [
      'ARRAYJOIN(ARRAYUNIQUE(values))',
      'COUNTALL(ARRAYUNIQUE(values))',
    ],
    docsUrl: ROLLUP_DOCS,
  },
  [RollupModifier.ARRAYCOMPACT]: {
    description: 'Drops blank values and empty text',
    syntax: 'ARRAYCOMPACT(values)',
    examples: ['ARRAYJOIN(ARRAYCOMPACT(values))'],
    docsUrl: ROLLUP_DOCS,
  },
  [RollupModifier.ARRAYSLICE]: {
    description:
      'Values from position start to end (1-based, negative counts from the end), in link order',
    syntax: 'ARRAYSLICE(values, start, [end])',
    examples: [
      'ARRAYJOIN(ARRAYSLICE(values, 1, 3))',
      'ARRAYJOIN(ARRAYSLICE(values, -1))',
    ],
    docsUrl: ROLLUP_DOCS,
  },
  [RollupModifier.ARRAYFLATTEN]: {
    description:
      'Accepted for Airtable compatibility — values are already flat',
    syntax: 'ARRAYFLATTEN(values)',
    examples: ['ARRAYJOIN(ARRAYFLATTEN(values))'],
    docsUrl: ROLLUP_DOCS,
  },
};
