import { ESTIMATED_LEAF_BYTES } from '../../fn-handler.interface';
import type {
  FnNodeContext,
  FnNodeEstimateContext,
  FnNodeHandlerInterface,
} from '../../fn-handler.interface';

/** `identifier` — a column reference, resolved through `aliasToColumn`. */
export class IdentifierGeneralHandler implements FnNodeHandlerInterface {
  readonly kind = 'identifier' as const;

  async compile(ctx: FnNodeContext): Promise<{ builder: any }> {
    const { knex, aliasToColumn, tableAlias, parentColumns } = ctx;
    const pt = ctx.pt as FnNodeContext['pt'] & { name: string };

    const { builder } =
      (await aliasToColumn?.[pt.name]?.({
        tableAlias,
        parentColumns,
      })) || {};
    if (typeof builder === 'function') {
      return { builder: knex.raw(`??`, builder(pt.fnName)) };
    }

    if (knex.clientType() === 'databricks' && builder.toQuery().endsWith(')')) {
      // limit 1 for subquery
      return {
        builder: knex.raw(`${builder.toQuery().replace(/\)$/, '')} LIMIT 1)`),
      };
    }

    return { builder: knex.raw(`??`, [builder || pt.name]) };
  }

  /**
   * The whole error budget of a formula-size estimate sits here — every
   * multiplier above a leaf is exact. `leafBytes` carries the size
   * `sizeTreeLeaves` computed by walking this column's reference closure;
   * without it there is nothing to do but return the floor.
   */
  estimate(ctx: FnNodeEstimateContext): number {
    const name = (ctx.pt as { name?: string }).name;
    return (
      (name === undefined ? undefined : ctx.leafBytes?.(name)) ??
      ESTIMATED_LEAF_BYTES
    );
  }
}
