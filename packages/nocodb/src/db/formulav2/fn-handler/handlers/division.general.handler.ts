import { FormulaDataTypes, JSEPNode } from 'nocodb-sdk';
import { fnSlots, isCallTo, setFnSlots } from '../fn-node';
import type { CallExpressionNode, ParsedFormulaNode } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FnEmitContext,
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
export class DivisionGeneralHandler implements FnHandlerInterface {
  readonly key: FnHandlerKey = '/';

  readonly variant: FnVariant = 'general';

  multiplicity(_pt: FnNode): number[] {
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

  prepareOperands(operands: string[], _knex: CustomKnex): string[] {
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
}
