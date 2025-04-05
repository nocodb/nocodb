import type {
  ArrayExpressionNode,
  BinaryExpressionNode,
  CallExpressionNode,
  CompoundNode,
  IdentifierNode,
  LiteralNode,
  MemberExpressionNode,
  ParsedFormulaNode,
  UnaryExpressionNode,
} from 'nocodb-sdk';
import type { BaseUser, Column, Model, User } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export interface FormulaBaseParams {
  baseModelSqlv2: IBaseModelSqlV2;
  tableAlias?: string;
  baseUsers?: (Partial<User> & BaseUser)[];
}

export type TAliasToColumn = Record<
  string,
  (parentColumns?: Set<string>) => Promise<{ builder: any }>
>;

export interface FormulaQueryBuilderBaseParams extends FormulaBaseParams {
  _tree;
  model: Model;
  aliasToColumn?: TAliasToColumn;
  parsedTree?: ParsedFormulaNode;
  column?: Column;
  parentColumns: Set<string>;
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
