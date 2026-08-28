import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { ieeeSqrtSql } from '~/db/formulav2/pg-ieee';

/** `SQRT(x)` — negative input is NaN in IEEE, an error in pg. */
export class SqrtPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'SQRT';

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.isIeee(variant) ? [2] : super.multiplicity(pt, variant);
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [source] = ctx.operands;
    if (!this.isIeee(ctx.variant)) return `sqrt(${source})`;
    return ieeeSqrtSql(source);
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    return this.isIeee(ctx.variant) ? ieeeSqrtSql('').length : 'sqrt()'.length;
  }
}
