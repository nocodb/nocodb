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
  // Opt-in, display path only: emits pg IEEE error values (Infinity/NaN).
  // Sort, filter and aggregation must leave this unset so errors stay NULL and
  // are skipped by aggregates rather than poisoning them with NaN.
  displayMode?: boolean;
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
