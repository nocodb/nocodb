import { FormulaDataTypes, JSEPNode } from './enums';
import { ReferencedInfo } from './types';

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
export type BaseFormulaNode = {
  type: JSEPNode;
  dataType?: FormulaDataTypes;
  cast?: FormulaDataTypes;
  errors?: Set<string>;
} & ReferencedInfo;

export interface BinaryExpressionNode extends BaseFormulaNode {
  operator: ArithmeticOperator | ComparisonOperator | StringOperator;
  type: JSEPNode.BINARY_EXP;
  right: ParsedFormulaNode;
  left: ParsedFormulaNode;
}

export interface CallExpressionNode extends BaseFormulaNode {
  type: JSEPNode.CALL_EXP;
  arguments: ParsedFormulaNode[];
  callee: {
    type?: string;
    name: string;
  };
}

export interface IdentifierNode extends BaseFormulaNode {
  type: JSEPNode.IDENTIFIER;
  name: string;
  raw: string;
}

export interface LiteralNode extends BaseFormulaNode {
  type: JSEPNode.LITERAL;
  value: string | number;
  raw: string;
}

export interface UnaryExpressionNode extends BaseFormulaNode {
  type: JSEPNode.UNARY_EXP;
  operator: string;
  argument: ParsedFormulaNode;
}

export interface ArrayExpressionNode extends BaseFormulaNode {
  type: JSEPNode.ARRAY_EXP;
}

export interface MemberExpressionNode extends BaseFormulaNode {
  type: JSEPNode.MEMBER_EXP;
}

export interface CompoundNode extends BaseFormulaNode {
  type: JSEPNode.COMPOUND;
}

export type ParsedFormulaNode =
  | BinaryExpressionNode
  | CallExpressionNode
  | IdentifierNode
  | LiteralNode
  | MemberExpressionNode
  | ArrayExpressionNode
  | UnaryExpressionNode
  | CompoundNode;
