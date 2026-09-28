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
import type { Knex } from 'knex';
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
  // Holds the built Raw of a referenced formula/button column per
  // (col.id + tableAlias) for one top-level build. Without it a formula that
  // references another k times re-expands that subtree k^depth times, which is
  // where a deep chain materializes a huge SQL string (an OOM vector).
  formulaBuilderCache?: Map<string, Knex.Raw>;
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
