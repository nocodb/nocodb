import type { CallExpressionNode, NcContext, UITypes } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Model } from '~/models';
import type {
  FnParsedTreeNode,
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
  /** pin the variant for specific keys, bypassing the rules */
  fnVariants?: Partial<Record<FnHandlerKey, FnVariant>>;
}

export type FormulaNodeCompiler = (
  pt: FnParsedTreeNode,
  prevBinaryOp?: string,
) => undefined | Promise<{ builder: any }>;

/**
 * `callExpressionBuilder`, injected rather than imported: the handlers live
 * below parsed-tree-builder, which imports them, so importing it back would
 * close the cycle.
 */
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
