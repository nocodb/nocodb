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
 * `%` with no IEEE guard: the bare operator, which is what every dialect except
 * pg-with-IEEE emits.
 *
 * The trailing space is not cosmetic — `binaryExpressionBuilder`'s fallthrough
 * arm produced `` `${sql} ` `` and callers have been byte-compared against that
 * form, so dropping it would change emitted SQL for every non-IEEE build.
 */
export class ModuloGeneralHandler implements FnHandlerInterface {
  readonly key: FnHandlerKey = '%';

  multiplicity(_pt: FnNode, _variant: FnVariant): number[] {
    return [1, 1];
  }

  /** no operand rewriting — `%` takes its operands as the tree spells them */
  prepareTree(_pt: FnNode): void {
    // intentionally empty
  }

  prepareOperands(
    operands: string[],
    _knex: CustomKnex,
    _variant: FnVariant,
    _pt: FnNode,
  ): string[] {
    return operands;
  }

  async emit(ctx: FnEmitContext): Promise<string> {
    const [left, right] = ctx.operands;
    return `${left} % ${right} `;
  }

  estimate(ctx: FnEstimateContext): number {
    const [left = 0, right = 0] = ctx.operands;
    return left + right + ' % '.length + 1;
  }
}
