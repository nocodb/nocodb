import { FormulaDataTypes } from 'nocodb-sdk';
import type { LiteralNode } from 'nocodb-sdk';
import type {
  FnNodeContext,
  FnNodeEstimateContext,
  FnNodeHandlerInterface,
} from '../../fn-handler.interface';

/** `unary_exp` — a prefixed `-`/`+`, folded into the literal where possible. */
export class UnaryExpressionGeneralHandler implements FnNodeHandlerInterface {
  readonly kind = 'unary_exp' as const;

  async compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    const { knex, fn, prevBinaryOp } = ctx;
    const pt = ctx.pt as FnNodeContext['pt'] & {
      operator: string;
      argument: any;
    };

    let query;
    if (
      (pt.operator === '-' || pt.operator === '+') &&
      pt.dataType === FormulaDataTypes.NUMERIC
    ) {
      query = knex.raw('?', [
        (pt.operator === '-' ? -1 : 1) *
          ((pt.argument as LiteralNode).value as number),
      ]);
    } else {
      query = knex.raw(
        `${pt.operator}${(
          await fn(pt.argument, pt.operator)
        ).builder.toQuery()}`,
      );
    }

    if (prevBinaryOp && pt.operator !== prevBinaryOp) {
      query.wrap('(', ')');
    }
    return { builder: query };
  }

  /** the operator character, plus its argument (parens when it wraps). */
  estimate(ctx: FnNodeEstimateContext): number {
    const pt = ctx.pt as { operator?: string; argument?: unknown };
    return (pt.operator?.length ?? 1) + ctx.estimate(pt.argument as never) + 2;
  }
}
