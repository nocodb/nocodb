export enum FormulaErrorType {
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  NOT_SUPPORTED = 'NOT_SUPPORTED',
  MIN_ARG = 'MIN_ARG',
  MAX_ARG = 'MAX_ARG',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  INVALID_ARG = 'INVALID_ARG',
  INVALID_ARG_TYPE = 'INVALID_ARG_TYPE',
  INVALID_ARG_VALUE = 'INVALID_ARG_VALUE',
  INVALID_ARG_COUNT = 'INVALID_ARG_COUNT',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  INVALID_FUNCTION_NAME = 'INVALID_FUNCTION_NAME',
  INVALID_COLUMN = 'INVALID_COLUMN',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
}

export enum FormulaDataTypes {
  NUMERIC = 'numeric',
  STRING = 'string',
  DATE = 'date',
  LOGICAL = 'logical',
  ARRAY = 'array',
  COND_EXP = 'conditional_expression',
  NULL = 'null',
  BOOLEAN = 'boolean',
  INTERVAL = 'interval',
  UNKNOWN = 'unknown',
}

export enum JSEPNode {
  COMPOUND = 'Compound',
  IDENTIFIER = 'Identifier',
  MEMBER_EXP = 'MemberExpression',
  LITERAL = 'Literal',
  THIS_EXP = 'ThisExpression',
  CALL_EXP = 'CallExpression',
  UNARY_EXP = 'UnaryExpression',
  BINARY_EXP = 'BinaryExpression',
  ARRAY_EXP = 'ArrayExpression',
}
