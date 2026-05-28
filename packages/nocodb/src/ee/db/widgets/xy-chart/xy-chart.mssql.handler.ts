import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { XyChartCommonHandler } from '~/db/widgets/xy-chart/xy-chart.common.handler';

export class XyChartMssqlHandler extends XyChartCommonHandler {
  protected applyOrderBy(
    query: Knex.QueryBuilder,
    sortField: string,
    orderDirection: string,
  ): void {
    // Validate and sanitize orderDirection
    const safeDirection =
      orderDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query.orderByRaw(query.client.raw(`?? ${safeDirection}`, [sortField]));
  }

  /**
   * T-SQL rejects SELECT-list aliases in GROUP BY — group by the underlying
   * expression instead. The SELECT keeps `(??) as ??` so downstream ORDER BY
   * / NOT IN can still reference `xAxisAlias` (T-SQL accepts aliases there).
   */
  protected applyTopNGroupBy(
    query: Knex.QueryBuilder,
    _xAxisAlias: string,
    xAxisColumnNameQuery: { builder: string | Knex.QueryBuilder },
    baseModel: IBaseModelSqlV2,
  ): void {
    query.groupBy(
      baseModel.dbDriver.raw('??', [xAxisColumnNameQuery.builder]),
    );
  }

  protected async buildOthersQuery(
    baseModel: IBaseModelSqlV2,
    buildBaseQuery: () => Promise<{ builder: Knex.QueryBuilder }>,
    xAxisColumnNameQuery: {
      builder: string | Knex.QueryBuilder;
    },
    xAxisAlias: string,
    yAxisSelections: Array<{
      alias: string;
      aggSql: string;
      field: {
        column_id: string;
        aggregation: any;
      };
    }>,
    sortFieldQuery: string | Knex.QueryBuilder | Knex.Raw,
    orderDirection: string,
    categoryLimit: number,
  ): Promise<{ builder: Knex.QueryBuilder }> {
    // Validate and sanitize orderDirection
    const safeDirection =
      orderDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { builder: othersQuery } = await buildBaseQuery();

    // Top N x-axis values — knex `.limit(n)` (no offset) emits `SELECT TOP (n)`
    // on T-SQL, which is legal inside a `NOT IN (subquery)`.
    const { builder: topNValuesSubquery } = await buildBaseQuery();
    topNValuesSubquery
      .select(baseModel.dbDriver.raw('??', [xAxisColumnNameQuery.builder]))
      .groupBy(baseModel.dbDriver.raw('??', [xAxisColumnNameQuery.builder]));

    // Add sorting aggregation to subquery for top N values
    const sortAggSql =
      yAxisSelections.length > 0 ? yAxisSelections[0].aggSql : 'COUNT(*)';
    topNValuesSubquery
      .select(baseModel.dbDriver.raw(`(${sortAggSql}) as sort_val`))
      .orderByRaw(`sort_val ${safeDirection}`)
      .limit(categoryLimit);

    // Exclude top-N values via NOT IN — MSSQL supports TOP inside NOT IN
    // subquery (the MySQL LIMIT-in-subquery restriction does not apply).
    othersQuery
      .select(baseModel.dbDriver.raw(`'Others' as ??`, [xAxisAlias]))
      .count('* as record_count')
      .whereRaw(`?? NOT IN (??)`, [
        baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]),
        topNValuesSubquery
          .clone()
          .clearSelect()
          .clearOrder()
          // Order by sort field query — can't use alias here since we drop
          // the SELECT below for `?? NOT IN (...)` (one-column subquery).
          .orderByRaw(
            baseModel.dbDriver.raw(`(??) ${safeDirection}`, [sortFieldQuery]),
          )
          .select(baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder])),
      ]);

    // Add Y-axis aggregations for others query
    yAxisSelections.forEach(({ alias, aggSql }) => {
      othersQuery.select(baseModel.dbDriver.raw(`(${aggSql}) as ??`, [alias]));
    });

    return {
      builder: othersQuery,
    };
  }
}
