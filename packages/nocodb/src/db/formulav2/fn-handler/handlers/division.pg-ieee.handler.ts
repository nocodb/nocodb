import { DivisionGeneralHandler } from './division.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FnEmitContext,
  FnVariant,
} from '~/db/formulav2/fn-handler/fn-handler.interface';
import type { FnNode } from '~/db/formulav2/fn-handler/fn-node';
import {
  coalesceNumericOperand,
  ieeeDivisionSql,
} from '~/db/formulav2/pg-ieee';

/**
 * Airtable semantics on pg: `x/0` is ±Infinity, `0/0` is NaN. pg raises instead
 * of producing those, so the value is introduced by hand — see
 * `ieeeDivisionSql` for why `left * Infinity` is the cheapest exact form.
 *
 * It is also the reason this file exists: that form mentions both operands
 * twice, and `/` is left-associative, so a chain of divisions grows the SQL
 * text ~2ⁿ. Any fix for that is a sibling variant, not an edit to this class.
 */
export class DivisionPgIeeeHandler extends DivisionGeneralHandler {
  override readonly variant: FnVariant = 'pg-ieee';

  override multiplicity(_pt: FnNode): number[] {
    return [2, 2];
  }

  /**
   * Blank-as-zero, unconditionally on both operands — a `/` operand is numeric
   * by construction after the FLOAT wrap, so there is no dataType to check.
   * Applied in every mode, not just display: if display coalesced but sort did
   * not, a blank operand would render as a number yet sort as NULL.
   */
  override prepareOperands(operands: string[], knex: CustomKnex): string[] {
    return operands.map((operand) => coalesceNumericOperand(operand, knex));
  }

  /**
   * Always the IEEE form: a divide-by-zero is a value, not a mode. The one
   * consumer that cannot take it — aggregation — drops non-finite rows at its
   * own site (`excludeNonFiniteSql`), so nothing has to be threaded through
   * the recursion here.
   */
  override async emit(ctx: FnEmitContext): Promise<string> {
    const [left, right] = ctx.operands;
    return ieeeDivisionSql(left, right);
  }
}
