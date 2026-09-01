import type {
  ArrayExpressionNode,
  BinaryExpressionNode,
  CallExpressionNode,
  CircularRefContext,
  CompoundNode,
  IdentifierNode,
  LiteralNode,
  MemberExpressionNode,
  ParsedFormulaNode,
  UITypes,
  UnaryExpressionNode,
} from 'nocodb-sdk';
import type { BaseUser, Column, Model, User } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export interface FormulaBaseParams {
  baseModelSqlv2: IBaseModelSqlV2;
  tableAlias?: string;
  baseUsers?: (Partial<User> & BaseUser)[];
}
export type TAliasToColumnParam = {
  tableAlias?: string;
  parentColumns?: CircularRefContext;
};
export type TAliasToColumn = Record<
  string,
  (params: TAliasToColumnParam) => Promise<{ builder: any }>
>;

export interface FormulaQueryBuilderBaseParams extends FormulaBaseParams {
  _tree;
  model: Model;
  aliasToColumn?: TAliasToColumn;
  columnIdToUidt?: Record<string, UITypes>;
  parsedTree?: ParsedFormulaNode;
  column?: Column;
  columns: Column[];
  parentColumns: CircularRefContext;
  getAliasCount: () => number;
  // Memoizes the built SQL of a referenced formula/button column per
  // (col.id + tableAlias) within a single top-level build. Without it a formula
  // that references another formula multiple times (directly or via a diamond
  // dependency) rebuilds that subtree once per occurrence — exponential in
  // nesting depth (k^D), materializing a huge SQL string (an OOM vector).
  formulaBuilderCache?: Map<string, { sql: string; bindings: readonly any[] }>;
}
export type FnParsedTreeBase = {
  fnName?: string;
  argsCount?: number;
};
export type FnParsedTreeNode =
  | (BinaryExpressionNode & FnParsedTreeBase)
  | (CallExpressionNode & FnParsedTreeBase)
  | (IdentifierNode & FnParsedTreeBase)
  | (LiteralNode & FnParsedTreeBase)
  | (MemberExpressionNode & FnParsedTreeBase)
  | (ArrayExpressionNode & FnParsedTreeBase)
  | (UnaryExpressionNode & FnParsedTreeBase)
  | (CompoundNode & FnParsedTreeBase);
