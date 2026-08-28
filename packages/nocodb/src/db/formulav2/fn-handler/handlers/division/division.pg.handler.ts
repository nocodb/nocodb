import {
  DivisionGeneralHandler,
  FLOAT_WRAP_BYTES,
} from './division.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import {
  coalesceNumericOperand,
  ieeeDivisionSql,
} from '~/db/formulav2/pg-ieee';

/**
 * `/` on pg, for every lowering pg offers. Which one is not this class's
 * decision: `resolveFnVariant` makes it centrally — so the query plan can pin a
 * variant onto one site — and hands the answer down as `variant`. That is why
 * there is one handler per dialect rather than one per variant.
 *
 * `pg-ieee` gives Airtable semantics: `x/0` is ±Infinity, `0/0` is NaN. pg
 * raises instead of producing those, so the value is introduced by hand — see
 * `ieeeDivisionSql` for why `left * Infinity` is the cheapest exact form. That
 * form mentions both operands twice and `/` is left-associative, so a chain
 * grows the SQL text ~2ⁿ; the fix for that will be a third variant here.
 */
/** what `coalesceNumericOperand` adds per operand in `prepareOperands`. */
const COALESCE_WRAP_BYTES = '(COALESCE(, 0))'.length;

export class DivisionPgHandler extends DivisionGeneralHandler {
  private isIeee(variant: FnVariant): boolean {
    return variant === 'pg-ieee';
  }

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.isIeee(variant) ? [2, 2] : super.multiplicity(pt, variant);
  }

  /**
   * Blank-as-zero, unconditionally on both operands — a `/` operand is numeric
   * by construction after the FLOAT wrap, so there is no dataType to check.
   * Applied in every mode, not just display: if display coalesced but sort did
   * not, a blank operand would render as a number yet sort as NULL.
   */
  override prepareOperands(
    operands: string[],
    knex: CustomKnex,
    variant: FnVariant,
  ): string[] {
    if (!this.isIeee(variant)) {
      return super.prepareOperands(operands, knex, variant);
    }
    return operands.map((operand) => coalesceNumericOperand(operand, knex));
  }

  /**
   * The IEEE form treats a divide-by-zero as a value, not a mode. The one
   * consumer that cannot take it — aggregation — drops non-finite rows at its
   * own site (`excludeNonFiniteSql`), so nothing has to be threaded through
   * the recursion here.
   */
  override async emit(ctx: FnEmitContext): Promise<string> {
    if (!this.isIeee(ctx.variant)) return super.emit(ctx);
    const [left, right] = ctx.operands;
    return ieeeDivisionSql(left, right);
  }

  /**
   * Overhead read off the template itself rather than hand-counted, so an edit
   * to `ieeeDivisionSql` cannot silently invalidate this. Both operands land
   * twice — the same counts `multiplicity` reports.
   */
  override estimate(ctx: FnEstimateContext): number {
    if (!this.isIeee(ctx.variant)) return super.estimate(ctx);
    const mult = this.multiplicity(ctx.pt, ctx.variant);
    // each operand carries the FLOAT wrap from prepareTree and the COALESCE
    // from prepareOperands before emit copies it `mult` times
    const wrapped = ctx.operands.map(
      (bytes) => bytes + FLOAT_WRAP_BYTES + COALESCE_WRAP_BYTES,
    );
    const [left = 0, right = 0] = wrapped;
    return (
      ieeeDivisionSql('', '').length +
      left * (mult[0] ?? 1) +
      right * (mult[1] ?? 1)
    );
  }
}
