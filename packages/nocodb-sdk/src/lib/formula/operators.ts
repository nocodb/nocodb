export const StringOperators = ['||', '&'] as const;
// `%` is undocumented — not in the function list, never suggested by the UI —
// but jsep parses it and the builders lower it, so the node type must admit it.
export const ArithmeticOperators = ['+', '-', '*', '/', '%'] as const;
export const ComparisonOperators = [
  '==',
  '=',
  '<',
  '>',
  '<=',
  '>=',
  '!=',
] as const;
export type ArithmeticOperator = (typeof ArithmeticOperators)[number];
export type ComparisonOperator = (typeof ComparisonOperators)[number];
export type StringOperator = (typeof StringOperators)[number];
