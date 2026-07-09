import { AllAggregations } from 'nocodb-sdk';
import type { Knex } from '~/db/CustomKnex';
import type { AggregationGeneratorParams } from '~/dbQueryClient/types';
import type {
  AggregationHandlerInterface,
  AggregationSqlContext,
} from '~/dbQueryClient/aggregations/aggregation-handler.interface';

/**
 * Base aggregation strategy. Owns the dialect-agnostic flow:
 *
 *   1. `buildContext()` — derive the per-dialect inputs (sentinel value,
 *      materialized sources, …).
 *   2. dispatch to the matching category method (`common` / `numerical` /
 *      `boolean` / `date` / `attachment`).
 *   3. `postProcess()` — dialect hook (mssql/oracle wrap materialized
 *      aggregates in a scalar subquery).
 *   4. `wrap()` — COALESCE-to-0 (except earliest/latest date) and apply the
 *      output alias.
 *
 * Concrete dialect handlers override `buildContext()` and the category methods
 * they support; everything else is inherited. This mirrors the
 * `field-handler` generic/dialect handler split.
 */
export abstract class GenericAggregationHandler
  implements AggregationHandlerInterface
{
  generate(params: AggregationGeneratorParams): string | undefined {
    const ctx = this.buildContext(params);

    let aggregationSql: Knex.Raw | undefined;
    switch (ctx.aggType) {
      case 'common':
        aggregationSql = this.common(ctx);
        break;
      case 'numerical':
        aggregationSql = this.numerical(ctx);
        break;
      case 'boolean':
        aggregationSql = this.boolean(ctx);
        break;
      case 'date':
        aggregationSql = this.date(ctx);
        break;
      case 'attachment':
        aggregationSql = this.attachment(ctx);
        break;
      default:
        break;
    }

    if (!aggregationSql) {
      return undefined;
    }

    aggregationSql = this.postProcess(ctx, aggregationSql);

    return this.wrap(ctx, aggregationSql);
  }

  /** Derive the dialect-specific context fields from the raw params. */
  protected abstract buildContext(
    params: AggregationGeneratorParams,
  ): AggregationSqlContext;

  // Category strategies — default to "unsupported" (undefined). Dialect handlers
  // override the ones they implement.
  protected common(_ctx: AggregationSqlContext): Knex.Raw | undefined {
    return undefined;
  }

  protected numerical(_ctx: AggregationSqlContext): Knex.Raw | undefined {
    return undefined;
  }

  protected boolean(_ctx: AggregationSqlContext): Knex.Raw | undefined {
    return undefined;
  }

  protected date(_ctx: AggregationSqlContext): Knex.Raw | undefined {
    return undefined;
  }

  protected attachment(_ctx: AggregationSqlContext): Knex.Raw | undefined {
    return undefined;
  }

  /**
   * Dialect post-processing applied to the raw aggregate before the shared
   * COALESCE/alias wrap. No-op by default; mssql/oracle override to wrap
   * materialized virtual-column aggregates in a scalar subquery.
   */
  protected postProcess(
    _ctx: AggregationSqlContext,
    aggregationSql: Knex.Raw,
  ): Knex.Raw {
    return aggregationSql;
  }

  /** Shared COALESCE-to-0 (except earliest/latest date) + output alias. */
  protected wrap(
    ctx: AggregationSqlContext,
    aggregationSql: Knex.Raw,
  ): string | undefined {
    const { knex, aggregation, alias } = ctx;

    let result = aggregationSql;

    if (
      ![AllAggregations.EarliestDate, AllAggregations.LatestDate].includes(
        aggregation as any,
      )
    ) {
      result = knex.raw(`COALESCE(??, 0)`, [result]);
    }

    if (alias) {
      result = knex.raw(`?? AS ??`, [result, alias]);
    }

    return result?.toQuery();
  }
}
