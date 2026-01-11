export const StringOperators = ['||', '&'] as const;
export const ArithmeticOperators = ['+', '-', '*', '/'] as const;
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
