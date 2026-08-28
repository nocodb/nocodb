import { FormulaDataTypes } from 'nocodb-sdk';
import { ModuloGeneralHandler } from './modulo.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FnEmitContext,
  FnEstimateContext,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import { coalesceNumericOperand, ieeeModuloSql } from '~/db/formulav2/pg-ieee';

/** what `coalesceNumericOperand` adds to an operand it applies to. */
const COALESCE_WRAP_BYTES = 'COALESCE(, 0)'.length;

/**
 * `%` on pg. Under IEEE it is the operator spelling of MOD(), so it gets MOD's
 * lowering — and it needs it: the blank-as-zero coalescing below turns a blank
 * divisor into a literal 0, which pg rejects with `division by zero` rather
 * than returning NULL. `ieeeModuloSql` guards the divisor and tests the
 * dividend for finiteness, so both operands land twice.
 */
export class ModuloPgHandler extends ModuloGeneralHandler {
  private isIeee(variant: FnVariant): boolean {
    return variant === 'pg-ieee';
  }

  override multiplicity(pt: FnNode, variant: FnVariant): number[] {
    return this.isIeee(variant) ? [2, 2] : super.multiplicity(pt, variant);
  }

  /**
   * Blank-as-zero, but only on a side declared NUMERIC — unlike `/`, whose
   * operands are numeric by construction after its FLOAT wrap. This reproduces
   * the pass `binaryExpressionBuilder` applied to `%` before it had a handler.
   */
  override prepareOperands(
    operands: string[],
    knex: CustomKnex,
    variant: FnVariant,
    pt: FnNode,
  ): string[] {
    if (!this.isIeee(variant)) {
      return super.prepareOperands(operands, knex, variant, pt);
    }
    const slots = [
      (pt as { left?: { dataType?: FormulaDataTypes } }).left,
      (pt as { right?: { dataType?: FormulaDataTypes } }).right,
    ];
    return operands.map((operand, i) =>
      slots[i]?.dataType === FormulaDataTypes.NUMERIC
        ? coalesceNumericOperand(operand, knex)
        : operand,
    );
  }

  override async emit(ctx: FnEmitContext): Promise<string> {
    if (!this.isIeee(ctx.variant)) return super.emit(ctx);
    const [left, right] = ctx.operands;
    return ieeeModuloSql(left, right);
  }

  /**
   * Overhead read off the template rather than hand-counted, so an edit to
   * `ieeeModuloSql` cannot silently invalidate it.
   */
  override estimate(ctx: FnEstimateContext): number {
    if (!this.isIeee(ctx.variant)) return super.estimate(ctx);
    const mult = this.multiplicity(ctx.pt, ctx.variant);
    const wrapped = ctx.operands.map((bytes) => bytes + COALESCE_WRAP_BYTES);
    const [left = 0, right = 0] = wrapped;
    return (
      ieeeModuloSql('', '').length +
      left * (mult[0] ?? 1) +
      right * (mult[1] ?? 1)
    );
  }
}
