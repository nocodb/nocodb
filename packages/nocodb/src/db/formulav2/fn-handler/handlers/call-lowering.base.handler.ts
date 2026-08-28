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
 * Shared shape for a lowering whose key is a FUNCTION name rather than an
 * operator.
 *
 * Two things differ from a binary lowering. There is no `prepareTree` or
 * `prepareOperands` work — a call's arguments are emitted as the tree spells
 * them, and any wrapping is part of the emitted template — so both are no-ops
 * here. And `ctx.operands` are the arguments' raw SQL in argument order, of
 * which there can be any number, so `multiplicity` and `estimate` are written
 * against the argument list rather than a fixed left/right pair.
 *
 * These are registered for pg only. Every other dialect resolves to no handler
 * and keeps going through `mapFunctionName`, which is what makes the migration
 * byte-neutral off pg.
 */
export abstract class CallLoweringHandler implements FnHandlerInterface {
  abstract readonly key: FnHandlerKey;

  protected isIeee(variant: FnVariant): boolean {
    return variant === 'pg-ieee';
  }

  /** the arguments, in order — `fnSlots` is shaped for binary operands */
  protected args(pt: FnNode): { dataType?: string }[] {
    return ((pt as { arguments?: { dataType?: string }[] }).arguments ??
      []) as { dataType?: string }[];
  }

  multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.args(pt).map(() => (this.isIeee(variant) ? 1 : 1));
  }

  prepareTree(_pt: FnNode): void {
    // a call's arguments need no rewriting before they are compiled
  }

  prepareOperands(
    operands: string[],
    _knex: CustomKnex,
    _variant: FnVariant,
    _pt: FnNode,
  ): string[] {
    return operands;
  }

  abstract emit(ctx: FnEmitContext): Promise<string>;

  /**
   * `overhead + Σ(operand × copies)`, with the overhead taken from the emitted
   * template so an edit to the lowering cannot silently invalidate it. This is
   * the term `call_exp.estimate` could not supply on its own: it sums each
   * argument exactly once, which under-counts every duplicating lowering.
   */
  estimate(ctx: FnEstimateContext): number {
    const mult = this.multiplicity(ctx.pt, ctx.variant);
    const operands = ctx.operands.reduce(
      (sum, bytes, i) => sum + bytes * (mult[i] ?? 1),
      0,
    );
    return this.templateBytes(ctx) + operands;
  }

  /** bytes the lowering writes that are not an operand */
  protected abstract templateBytes(ctx: FnEstimateContext): number;
}
