import { FormulaDataTypes, JSEPNode } from 'nocodb-sdk';
import { fnSlots, isCallTo, setFnSlots } from '../../fn-node';
import type { CallExpressionNode, ParsedFormulaNode } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerInterface,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';

/**
 * The pre-IEEE lowering of `/`, and the base its variants extend: divide by
 * `NULLIF(right, 0)` so a zero divisor yields NULL instead of raising. Each
 * operand is written once.
 *
 * Reached by every client except pg-with-IEEE — and note mysql2 never gets
 * here at all: it wraps the whole binary expression in `IFNULL` upstream and
 * returns NULL for `x/0` natively.
 */
/** ` / ` plus what `NULLIF(x, 0)` adds around the divisor. */
const DIVISION_TEMPLATE_BYTES = ' / '.length + 'NULLIF(, 0)'.length;

/**
 * What `prepareTree`'s FLOAT() wrap costs per operand once the dialect expands
 * it. A handler owns three byte-producing stages — prepareTree, prepareOperands
 * and emit — so an estimate that models only `emit` under-counts every operand
 * by whatever the other two add. pg spells it `CAST(x as DOUBLE PRECISION)`;
 * the shorter spellings elsewhere (mssql `FLOAT(x)`) make this the pessimistic
 * end, which is the safe direction for a size gate.
 */
export const FLOAT_WRAP_BYTES = '(CAST( as DOUBLE PRECISION))'.length;

export class DivisionGeneralHandler implements FnHandlerInterface {
  readonly key: FnHandlerKey = '/';

  multiplicity(_pt: FnNode, _variant: FnVariant): number[] {
    return [1, 1];
  }

  /**
   * Both operands are cast to float so integer division does not truncate.
   * Shared by every variant — the IEEE form additionally relies on it, since
   * its branches unify as float8 and `numeric` could not hold Infinity before
   * pg 14. The wrappers carry no dataType, so callers that need the operand
   * types must capture them before this runs.
   *
   * Idempotent. The parsed tree is a cached, model-owned object and this mutates
   * it in place, so a second build over the same tree — which is exactly what
   * the CTE hoist rebuild does — used to wrap an already-wrapped operand. The
   * extra `CAST(… AS DOUBLE PRECISION)` was harmless but grew the rebuilt SQL,
   * biasing the gate's `rebuilt < inline` check against hoisting.
   */
  prepareTree(pt: FnNode): void {
    setFnSlots(
      pt,
      fnSlots(pt).map((slot) =>
        isCallTo(slot, 'FLOAT')
          ? slot
          : ({
              callee: { name: 'FLOAT' },
              type: JSEPNode.CALL_EXP,
              arguments: [slot],
            } as CallExpressionNode as ParsedFormulaNode),
      ),
    );
  }

  prepareOperands(
    operands: string[],
    _knex: CustomKnex,
    _variant: FnVariant,
  ): string[] {
    return operands;
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [left] = ctx.operands;
    // The divisor is recompiled through NULLIF rather than wrapped as text so
    // it goes through the same call-expression path as any other function.
    const right = await ctx.compileCall({
      context: ctx.context,
      pt: {
        callee: { name: 'NULLIF', type: 'Identifier' },
        dataType: FormulaDataTypes.NUMERIC,
        type: JSEPNode.CALL_EXP,
        arguments: [
          fnSlots(ctx.pt)[1],
          {
            type: JSEPNode.LITERAL,
            dataType: FormulaDataTypes.NUMERIC,
            value: 0,
            raw: '0',
          },
        ],
      } as CallExpressionNode,
      fn: ctx.fn,
      prevBinaryOp: ctx.prevBinaryOp,
      aliasToColumn: ctx.aliasToColumn,
      knex: ctx.knex,
      model: ctx.model,
      columnIdToUidt: ctx.columnIdToUidt,
    });
    return `${left} / ${right.builder}`;
  }

  /**
   * `left / NULLIF(right, 0)` — each operand once, plus the template, plus the
   * FLOAT wrap `prepareTree` put round both operands.
   */
  estimate(ctx: FnEstimateContext): number {
    const [left = 0, right = 0] = ctx.operands;
    return DIVISION_TEMPLATE_BYTES + left + right + FLOAT_WRAP_BYTES * 2;
  }
}
