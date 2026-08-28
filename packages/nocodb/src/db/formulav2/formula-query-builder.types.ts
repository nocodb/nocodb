import type {
  ArrayExpressionNode,
  BinaryExpressionNode,
  CallExpressionNode,
  CircularRefContext,
  CompoundNode,
  IdentifierNode,
  LiteralNode,
  MemberExpressionNode,
  UITypes,
  UnaryExpressionNode,
} from 'nocodb-sdk';
import type { BaseUser, Column, Model, User } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { ICteScope } from '~/db/cte-generator/types';
import type {
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
// plan/types imports only the sdk and fn-handler, so this cannot cycle back
import type {
  FormulaPayload,
  NodeOptimization,
} from '~/db/formulav2/plan/types';

/**
 * Per-build overrides for how an expression is generated. Every field is a pin
 * on a decision the emitter would otherwise make from the dialect alone, so an
 * empty (or absent) object is byte-identical to having none.
 */
export interface FormulaBuildHints {
  /**
   * Pin which lowering a handled function/operator emits, for every occurrence
   * of it — see db/formulav2/fn-handler. To pin one occurrence, annotate that
   * node instead: `optimization.variant` on the node beats this.
   */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}

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
  /**
   * The tree to build, and whatever the plan concluded about it. Omit it and the
   * formula string is parsed and persisted instead. Every nested build must pass
   * its OWN column's payload — inheriting the caller's would build the caller's
   * tree, the same hazard the bare `parsedTree` had.
   */
  payload?: FormulaPayload;
  column?: Column;
  columns: Column[];
  parentColumns: CircularRefContext;
  getAliasCount: () => number;
  /**
   * When present, a lookup onto a Formula is hoisted into a keyed CTE block on
   * this scope instead of embedding that formula's expression inline. Absence
   * is the off switch — every existing caller omits it and gets byte-identical
   * SQL.
   */
  cteScope?: ICteScope;
  buildHints?: FormulaBuildHints;
}
export type FnParsedTreeBase = {
  fnName?: string;
  argsCount?: number;
  /**
   * The query plan's verdict for this node, when there is one. Set only on the
   * annotated copy `buildFormulaPayload` produces — a tree straight from the
   * model never carries it, which is why the first build is unaffected.
   */
  optimization?: NodeOptimization;
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
