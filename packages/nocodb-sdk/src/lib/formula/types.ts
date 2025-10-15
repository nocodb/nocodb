import { SqlUiFactory } from '../sqlUi';
import UITypes from '../UITypes';
import { FormulaDataTypes, JSEPNode } from './enums';
import {
  ArithmeticOperator,
  ComparisonOperator,
  StringOperator,
} from './operators';

export interface ReferencedInfo {
  referencedColumn?: {
    id: string;
    uidt: string;
    intermediaryUidt?: string;
    intermediaryId?: string;
  };
  invalidForReferenceColumn?: boolean;
  uidtCandidates?: UITypes[];
}

export type BaseFormulaNode = {
  type: JSEPNode;
  dataType?: FormulaDataTypes;
  isDataArray?: boolean;
  inArrayFormat?: boolean;
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

export interface FormulaMetaCustomValidation {
  (args: FormulaDataTypes[], parseTree: CallExpressionNode): void;
}

export interface FormulaMeta {
  validation?: {
    args?: {
      min?: number;
      max?: number;
      rqd?: number;

      // array of allowed types when args types are not same
      // types should be in order of args
      type?: FormulaDataTypes | FormulaDataTypes[];
    };
    custom?: FormulaMetaCustomValidation;
  };
  description?: string;
  syntax?: string;
  examples?: string[];
  returnType?: ((args: any[]) => FormulaDataTypes) | FormulaDataTypes;
  docsUrl?: string;
}
export type SqlUI = ReturnType<(typeof SqlUiFactory)['create']>;
export type ClientTypeOrSqlUI =
  | 'mysql'
  | 'pg'
  | 'sqlite3'
  | 'mysql2'
  | 'oracledb'
  | 'mariadb'
  | 'sqlite'
  | 'snowflake'
  | SqlUI;
