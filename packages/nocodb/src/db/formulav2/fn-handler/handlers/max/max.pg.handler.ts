import { FormulaDataTypes } from 'nocodb-sdk';
import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { stripNaNSql } from '~/db/formulav2/pg-ieee';

/**
 * `MAX(...)`. pg's GREATEST ranks NaN above every number, so `MAX(NaN, 5)` is
 * NaN where IEEE maxNum ignores NaN and returns 5. The guard strips NaN from
 * the arguments and falls back to the unstripped list, so an all-NaN argument
 * list still yields NaN instead of blanking — which writes the whole list
 * twice.
 *
 * Only when every argument is numeric: a non-numeric one takes the plain
 * `greatest`, since there is no NaN to rank. `LEAST` needs no twin of this for
 * the same reason it is already correct — NaN being largest means it never
 * wins a minimum — which is why `MIN` has no handler.
 */
export class MaxPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'MAX';

  private guarded(pt: FnNode, variant: FnVariant): boolean {
    return (
      this.isIeee(variant) &&
      this.args(pt).every((arg) => arg?.dataType === FormulaDataTypes.NUMERIC)
    );
  }

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.guarded(pt, variant)
      ? this.args(pt).map(() => 2)
      : super.multiplicity(pt, variant);
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const args = ctx.operands.map((operand) => `(${operand})`);
    if (!this.guarded(ctx.pt, ctx.variant)) {
      return `greatest(${args.join(', ')})`;
    }
    const stripped = args.map((arg) => stripNaNSql(arg));
    return `COALESCE(greatest(${stripped.join(', ')}), greatest(${args.join(
      ', ',
    )}))`;
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    const n = ctx.operands.length;
    const list = 'greatest()'.length + Math.max(0, n - 1) * ', '.length;
    // each argument is parenthesised before it is used
    const parens = n * '()'.length;
    if (!this.guarded(ctx.pt, ctx.variant)) return list + parens;
    return (
      'COALESCE(, )'.length +
      list * 2 +
      parens * 2 +
      n * (stripNaNSql('').length - 0)
    );
  }
}

/**
 * `greatest` is the same lowering under the name older columns stored — see
 * `PowPgHandler` for why a rewritten callee name is persisted.
 */
export class GreatestPgHandler extends MaxPgHandler {
  override readonly key: FnHandlerKey = 'GREATEST';
}
