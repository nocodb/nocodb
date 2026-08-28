import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { isFiniteSql } from '~/db/formulav2/pg-ieee';

/**
 * `ROUND(x)` / `ROUND(x, precision)`.
 *
 * ROUND is numeric-only, and casting ±Infinity/NaN to numeric raises on pg <
 * 14 — rounding a non-finite value is the value itself anyway — so the IEEE
 * form tests the operand for finiteness, rounds it, and returns it unrounded
 * otherwise. That writes the value operand THREE times, which nothing reported
 * before this handler existed: `ROUND` had no entry in the multiplicity table,
 * so the duplication analysis counted it once.
 */
export class RoundPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'ROUND';

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    if (!this.isIeee(variant)) return super.multiplicity(pt, variant);
    // the precision argument is written once; the value three times
    return this.args(pt).length > 1 ? [3, 1] : [3];
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [source] = ctx.operands;
    // an absent precision is the literal 0, matching pg's mapping
    const precision = ctx.operands.length > 1 ? ctx.operands[1] : '0';
    if (!this.isIeee(ctx.variant)) {
      return `ROUND((${source})::numeric, ${precision})`;
    }
    return `(CASE WHEN ${isFiniteSql(
      `(${source})`,
    )} THEN ROUND((${source})::numeric, ${precision}) ELSE (${source}) END)`;
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    if (!this.isIeee(ctx.variant)) return 'ROUND(()::numeric, )'.length;
    return (
      '(CASE WHEN  THEN ROUND(()::numeric, ) ELSE () END)'.length +
      isFiniteSql('()').length
    );
  }
}
