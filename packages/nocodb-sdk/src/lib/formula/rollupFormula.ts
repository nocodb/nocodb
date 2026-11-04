import UITypes from '../UITypes';
import { FormulaDataTypes, JSEPNode } from './enums';
import type {
  CallExpressionNode,
  FormulaMeta,
  ParsedFormulaNode,
} from './types';

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

const AGGREGATE_ALIASES: Record<string, RollupAggregate> = {
  AVG: RollupAggregate.AVERAGE,
  CONCAT: RollupAggregate.CONCATENATE,
};

export const ROLLUP_ARRAYJOIN_DEFAULT_SEPARATOR = ', ';

export function getRollupAggregate(name: string): RollupAggregate | undefined {
  const upper = name?.toUpperCase();
  if (!upper) return undefined;
  if (upper in AGGREGATE_ALIASES) return AGGREGATE_ALIASES[upper];
  return Object.values(RollupAggregate).includes(upper as RollupAggregate)
    ? (upper as RollupAggregate)
    : undefined;
}

export function getRollupModifier(name: string): RollupModifier | undefined {
  const upper = name?.toUpperCase();
  return Object.values(RollupModifier).includes(upper as RollupModifier)
    ? (upper as RollupModifier)
    : undefined;
}

export const isRollupFormula = (colOptions?: {
  rollup_function?: string;
}): boolean => colOptions?.rollup_function === ROLLUP_FORMULA_FUNCTION;

/**
 * Whether `node` references `values` outside any aggregate. An aggregate call
 * binds the `values` inside it, so `MIN(SUM(values), 10)` has no free values
 * (MIN is a plain function there) while `MIN(values)` does (MIN aggregates).
 */
export function hasFreeRollupValues(node: ParsedFormulaNode): boolean {
  if (!node) return false;
  switch (node.type) {
    case JSEPNode.IDENTIFIER:
      return (node as { name: string }).name === ROLLUP_VALUES_KEYWORD;
    case JSEPNode.CALL_EXP: {
      const call = node as CallExpressionNode;
      if (getRollupAggregate(call.callee?.name)) return false;
      return call.arguments?.some(hasFreeRollupValues) ?? false;
    }
    case JSEPNode.BINARY_EXP:
      return (
        hasFreeRollupValues((node as any).left) ||
        hasFreeRollupValues((node as any).right)
      );
    case JSEPNode.UNARY_EXP:
      return hasFreeRollupValues((node as any).argument);
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
      const call = n as CallExpressionNode;
      if (call.rollupAggregate) {
        result.push(call);
        return;
      }
      call.arguments?.forEach(walk);
    } else if (n.type === JSEPNode.BINARY_EXP) {
      walk((n as any).left);
      walk((n as any).right);
    } else if (n.type === JSEPNode.UNARY_EXP) {
      walk((n as any).argument);
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
  const call = parsedTree as CallExpressionNode;
  if (call?.type !== JSEPNode.CALL_EXP || !call.rollupAggregate) return false;
  if (
    ![
      RollupAggregate.SUM,
      RollupAggregate.AVERAGE,
      RollupAggregate.MIN,
      RollupAggregate.MAX,
    ].includes(call.rollupAggregate as RollupAggregate)
  )
    return false;
  // the bare `values` (through modifiers), not a per-value expression
  let arg = call.arguments?.[0] as ParsedFormulaNode;
  while (
    arg?.type === JSEPNode.CALL_EXP &&
    (arg as CallExpressionNode).rollupModifier
  ) {
    arg = (arg as CallExpressionNode).arguments?.[0];
  }
  return (
    arg?.type === JSEPNode.IDENTIFIER &&
    (arg as { name: string }).name === ROLLUP_VALUES_KEYWORD
  );
}

const INTEGER_TARGET_TYPES = [
  UITypes.Number,
  UITypes.Links,
  UITypes.Rating,
  UITypes.AutoNumber,
  UITypes.Year,
  UITypes.Count,
];

/** Whether every value of a numeric rollup formula result is a whole number */
export function isIntegerRollupFormula(parsedTree?: ParsedFormulaNode) {
  const call = parsedTree as CallExpressionNode;
  if (call?.type !== JSEPNode.CALL_EXP) return false;
  if (
    [
      RollupAggregate.COUNT,
      RollupAggregate.COUNTA,
      RollupAggregate.COUNTALL,
    ].includes(call.rollupAggregate as RollupAggregate)
  )
    return true;
  // MIN / MAX over text is always 0
  if (
    [RollupAggregate.MIN, RollupAggregate.MAX].includes(
      call.rollupAggregate as RollupAggregate
    ) &&
    (call.arguments?.[0] as ParsedFormulaNode)?.dataType ===
      FormulaDataTypes.STRING
  )
    return true;
  // SUM / MIN / MAX of a whole-number field stays whole
  return (
    [RollupAggregate.SUM, RollupAggregate.MIN, RollupAggregate.MAX].includes(
      call.rollupAggregate as RollupAggregate
    ) &&
    rollupFormulaKeepsTargetFormat(parsedTree) &&
    INTEGER_TARGET_TYPES.includes(call.referencedColumn?.uidt as UITypes)
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
  if (column?.uidt !== UITypes.Rollup) return undefined;
  const colOptions = column.colOptions as
    | {
        rollup_function?: string;
        parsed_tree?: ParsedFormulaNode;
        result_uidt?: string;
      }
    | undefined;
  if (isRollupFormula(colOptions)) {
    return rollupFormulaResultUidt(colOptions?.parsed_tree);
  }
  if (
    colOptions?.result_uidt === UITypes.Date ||
    colOptions?.result_uidt === UITypes.DateTime
  ) {
    return colOptions.result_uidt;
  }
  return undefined;
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
      // MIN/MAX of a date-only field stays a date (no time, no timezone)
      return rollupFormulaKeepsTargetFormat(parsedTree) &&
        parsedTree.referencedColumn?.uidt === UITypes.Date
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
