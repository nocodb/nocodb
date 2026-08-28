import { CallLoweringHandler } from '../call-lowering.base.handler';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnHandlerKey,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { ieeeLogBaseSql, ieeeLogSql } from '~/db/formulav2/pg-ieee';

/**
 * `LOG(x)` and `LOG(base, value)`. Arity changes both the lowering and how
 * often each operand lands: the one-argument form proves the operand in domain
 * before taking the log, and the two-argument form proves both.
 */
export class LogPgHandler extends CallLoweringHandler {
  readonly key: FnHandlerKey = 'LOG';

  private hasBase(pt: FnNode): boolean {
    return this.args(pt).length > 1;
  }

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    if (!this.isIeee(variant)) return super.multiplicity(pt, variant);
    return this.hasBase(pt) ? [4, 3] : [2];
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    if (this.hasBase(ctx.pt)) {
      const [base, value] = ctx.operands;
      if (!this.isIeee(ctx.variant)) return `log(${base}, ${value})`;
      return ieeeLogBaseSql(base, value);
    }
    const [source] = ctx.operands;
    if (!this.isIeee(ctx.variant)) return `log(${source})`;
    return ieeeLogSql(source);
  }

  protected templateBytes(ctx: FnEstimateContext): number {
    if (this.hasBase(ctx.pt)) {
      return this.isIeee(ctx.variant)
        ? ieeeLogBaseSql('', '').length
        : 'log(, )'.length;
    }
    return this.isIeee(ctx.variant) ? ieeeLogSql('').length : 'log()'.length;
  }
}
