import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { ieeeModuloSql } from '~/db/formulav2/pg-ieee';

/** `MOD(x, y)` — the function spelling of `%`, and the same lowering. */
export class ModPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'MOD';

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    // guards the divisor, then tests the dividend for finiteness, then divides
    return this.isIeee(variant) ? [2, 2] : super.multiplicity(pt, variant);
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [x, y] = ctx.operands;
    if (!this.isIeee(ctx.variant))
      return `MOD((${x})::NUMERIC, (${y})::NUMERIC)`;
    return ieeeModuloSql(x, y);
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    return this.isIeee(ctx.variant)
      ? ieeeModuloSql('', '').length
      : 'MOD(()::NUMERIC, ()::NUMERIC)'.length;
  }
}
