import type {
  CallExpressionNode,
  CircularRefContext,
  ClientType,
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
 * expression, or the uppercased callee name for a call.
 *
 * `POW`/`GREATEST` are separate keys rather than aliases because a plain-string
 * mapping in `functionMappings` rewrites `pt.callee.name` and that rewritten
 * tree is persisted — so a POWER column created before POWER became a function
 * still arrives spelled `pow`, and would otherwise resolve to no handler.
 *
 * `MIN` is deliberately absent: it maps to a bare `least`, writes each operand
 * once, and has no IEEE form to guard.
 */
export type FnHandlerKey =
  | '/'
  | '%'
  | 'MOD'
  | 'POWER'
  | 'POW'
  | 'LOG'
  | 'SQRT'
  | 'MAX'
  | 'GREATEST'
  | 'ROUND';

/** Bucket for a handler that serves every dialect — mirrors field-handler. */
export const CLIENT_DEFAULT = '_default';

/** A registry's dialect axis: a specific client, or the catch-all. */
export type FnClient = ClientType | typeof CLIENT_DEFAULT;

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
  /**
   * Which dialect's bucket to resolve from. Absent falls back to
   * `CLIENT_DEFAULT`, so a caller that does not care gets the dialect-neutral
   * handler rather than an error.
   */
  clientType?: ClientType;
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
  /**
   * The lowering `resolveFnVariant` chose for THIS site. Resolution stays in the
   * registry — the plan has to be able to name a variant for a specific node —
   * but the class no longer encodes it, so one handler per dialect serves every
   * variant that dialect offers.
   */
  variant: FnVariant;
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
  /** Bytes `compile` would produce, without building anything. */
  estimate(ctx: FnNodeEstimateContext): number;
}

export interface FnHandlerInterface {
  readonly key: FnHandlerKey;
  /**
   * How many copies of each operand slot `emit` writes, for the given variant.
   * Read by the formula query plan to size the expression before it is built —
   * see `plan/duplication.ts`. Takes the node because the count can depend on
   * it: a variadic `MAX` has one entry per argument, `LOG` differs by arity.
   * A variant that stops duplicating must say so here, or the plan will keep
   * reporting bloat that is no longer emitted.
   */
  multiplicity(pt: FnNode, variant: FnVariant): number[];
  /** Operand-node rewrites needed before the operands are compiled. */
  prepareTree(pt: FnNode): void;
  /**
   * Rewrites on the compiled operand SQL, in slot order. Takes the node because
   * a rewrite can be conditional on an operand's declared type — `%` coalesces
   * only its NUMERIC sides, where `/` can coalesce both unconditionally because
   * its `prepareTree` already made them numeric.
   */
  prepareOperands(
    operands: string[],
    knex: CustomKnex,
    variant: FnVariant,
    pt: FnNode,
  ): string[];
  emit(ctx: FnEmitContext): Promise<string>;
  /**
   * Bytes `emit` would write, given its operands' sizes. Exact for a lowering
   * whose emitted form is a fixed template — take the overhead straight from
   * that template rather than hand-counting, so the two cannot drift.
   */
  estimate(ctx: FnEstimateContext): number;
}

/**
 * What a size estimate is computed from. Compositional: the operands' estimates
 * are already known when a handler is asked for its own, so a handler only has
 * to account for what IT writes.
 */
export interface FnEstimateContext {
  pt: FnNode;
  /** estimated bytes of each operand slot, in slot order */
  operands: number[];
  variant: FnVariant;
}

/** Estimating a node of any kind — recurses back through the node registry. */
export interface FnNodeEstimateContext {
  pt: FnNode;
  /** estimate a child node */
  estimate: (node: FnNode) => number;
  clientType?: ClientType;
  pgIeee?: boolean;
  /**
   * Bytes this column reference expands to, pre-resolved by `sizeTreeLeaves`.
   * Supplying it is what makes the estimate usable; without it the leaf term
   * falls back to `ESTIMATED_LEAF_BYTES` and the whole estimate is a lower
   * bound, not a prediction — see below.
   */
  leafBytes?: (name: string) => number | undefined;
}

/**
 * Fallback for a leaf nobody sized. An Identifier expands to anything from a
 * 19-byte quoted column to a multi-hop sub-query in the hundreds of bytes that
 * keeps growing with the reference chain below it, so a constant here cannot
 * be right: measured against real schemas it runs 7x to 1857x UNDER, which is
 * the dangerous direction for a size gate.
 *
 * Every structural multiplier above a leaf is exact — verified against emitted
 * SQL, including the ~2ⁿ growth of an IEEE division chain — so the whole-tree
 * error IS this term's error. Pass `leafBytes` (see `plan/leaf-size.ts`) and
 * the estimate lands within ~1.3x and on the high side; leave it out and treat
 * the result as a floor only.
 */
export const ESTIMATED_LEAF_BYTES = 24;

/** A resolved lowering: the class to drive, and which of its forms to emit. */
export interface ResolvedFnHandler {
  handler: FnHandlerInterface;
  variant: FnVariant;
}
