import type {
  CallExpressionNode,
  CircularRefContext,
  NcContext,
  UITypes,
} from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Model } from '~/models';
import type {
  FnParsedTreeNode,
  FormulaBuildHints,
  TAliasToColumn,
} from '~/db/formulav2/formula-query-builder.types';
import type { FnNode } from './fn-node';

/**
 * What a handler is registered against: the operator spelling for a binary
 * expression, or the uppercased callee name for a call. Grows as lowerings move
 * in — `%`, `MOD`, `POWER`, `LOG`, `SQRT`, `MAX`, `MIN` are all candidates.
 */
export type FnHandlerKey = '/';

/**
 * Which lowering of a given key to emit. `general` is the dialect-neutral form
 * every key must provide; the rest are named alternatives the resolver picks or
 * a caller pins.
 */
export type FnVariant = 'general' | 'pg-ieee';

/**
 * What variant selection is conditioned on. Plain data, deliberately no knex:
 * the query planner resolves the same handler to read its `multiplicity`, and
 * it has no connection.
 */
export interface FnConditions {
  /** pg AND NC_FORMULA_PG_IEEE — `isPgIeeeEnabled` */
  pgIeee?: boolean;
  /**
   * Pin the variant for specific keys, bypassing the rules. Key-wide: it hits
   * every occurrence of the operator.
   *
   * To pin one occurrence, the node carries its own `optimization.variant` —
   * see `resolveFnVariant`. That is not a condition of the build, it is a
   * property of the expression, which is why it is not a field here.
   */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}

export type FormulaNodeCompiler = (
  pt: FnParsedTreeNode,
  prevBinaryOp?: string,
) => undefined | Promise<{ builder: any }>;

/** `callExpressionBuilder`'s shape, as `FnEmitContext` hands it to a lowering. */
export type CallExpressionCompiler = (args: {
  context: NcContext;
  pt: CallExpressionNode;
  fn: FormulaNodeCompiler;
  prevBinaryOp: string;
  aliasToColumn: TAliasToColumn;
  knex: CustomKnex;
  model: Model;
  columnIdToUidt: Record<string, UITypes>;
}) => Promise<{ builder: any }>;

export interface FnEmitContext {
  context: NcContext;
  /** the node being lowered, operand slots already rewritten by `prepareTree` */
  pt: FnParsedTreeNode;
  /** compiled operand SQL in slot order, after `prepareOperands` */
  operands: string[];
  knex: CustomKnex;
  fn: FormulaNodeCompiler;
  prevBinaryOp: string;
  aliasToColumn: TAliasToColumn;
  columnIdToUidt: Record<string, UITypes>;
  model: Model;
  compileCall: CallExpressionCompiler;
}

/**
 * Which kind of parsed-tree node a handler compiles. A separate namespace from
 * `FnHandlerKey` on purpose: these two levels nest — the `bin_exp` handler
 * resolves `/` from `FN_REGISTRY` while it runs — so sharing one key space
 * would make the outer dispatch look like recursion.
 */
export type FnNodeKind =
  | 'bin_exp'
  | 'call_exp'
  | 'literal'
  | 'identifier'
  | 'unary_exp';

/**
 * Everything a node handler can need. Wider than `FnEmitContext`: a lowering
 * receives operands already compiled, whereas a node handler owns the descent
 * and so needs `fn`, plus the alias/table state the Identifier case reads.
 */
export interface FnNodeContext {
  context: NcContext;
  pt: FnParsedTreeNode;
  fn: FormulaNodeCompiler;
  prevBinaryOp?: string;
  knex: CustomKnex;
  model: Model;
  aliasToColumn: TAliasToColumn;
  columnIdToUidt: Record<string, UITypes>;
  tableAlias?: string;
  parentColumns?: CircularRefContext;
  buildHints?: FormulaBuildHints;
}

/**
 * One node kind's compiler. Deliberately NOT `FnHandlerInterface`: of that
 * contract's five members a node handler would use only `key`. It returns a
 * builder rather than a SQL string, it has no operands to declare a
 * `multiplicity` for, and `prepareTree`/`prepareOperands` are things it *calls*
 * on the inner lowering rather than implements.
 */
export interface FnNodeHandlerInterface {
  readonly kind: FnNodeKind;
  compile(ctx: FnNodeContext): Promise<{ builder: any }>;
}

export interface FnHandlerInterface {
  readonly key: FnHandlerKey;
  readonly variant: FnVariant;
  /**
   * How many copies of each operand slot `emit` writes. Read by the formula
   * query plan to size the expression before it is built — see
   * `plan/duplication.ts`. Takes the node because the count can depend on it:
   * a variadic `MAX` has one entry per argument, `LOG` differs by arity.
   * A variant that stops duplicating must say so here, or the plan will keep
   * reporting bloat that is no longer emitted.
   */
  multiplicity(pt: FnNode): number[];
  /** Operand-node rewrites needed before the operands are compiled. */
  prepareTree(pt: FnNode): void;
  /** Rewrites on the compiled operand SQL, in slot order. */
  prepareOperands(operands: string[], knex: CustomKnex): string[];
  emit(ctx: FnEmitContext): Promise<string>;
}
