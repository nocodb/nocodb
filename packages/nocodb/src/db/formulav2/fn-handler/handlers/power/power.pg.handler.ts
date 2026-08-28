import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { ieeePowerSql } from '~/db/formulav2/pg-ieee';

/**
 * `POWER(base, exponent)`. A negative base raised to a fractional exponent is
 * NaN in IEEE but an error in pg, so the guard tests the base's sign and the
 * exponent for being whole — writing the base twice and the exponent three
 * times.
 */
export class PowerPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'POWER';

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.isIeee(variant) ? [2, 3] : super.multiplicity(pt, variant);
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [base, exponent] = ctx.operands;
    if (!this.isIeee(ctx.variant)) return `pow(${base}, ${exponent})`;
    return ieeePowerSql(base, exponent);
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    return this.isIeee(ctx.variant)
      ? ieeePowerSql('', '').length
      : 'pow(, )'.length;
  }
}

/**
 * `pow` is the same lowering under the name older columns stored: a plain
 * string mapping rewrote `pt.callee.name` and that tree is persisted, so a
 * POWER column created before POWER became a function still arrives as `pow`.
 */
export class PowPgHandler extends PowerPgHandler {
  override readonly key: FnHandlerKey = 'POW';
}
