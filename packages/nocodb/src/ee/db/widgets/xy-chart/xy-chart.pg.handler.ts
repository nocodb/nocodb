import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { XyChartCommonHandler } from '~/db/widgets/xy-chart/xy-chart.common.handler';

export class XyChartPgHandler extends XyChartCommonHandler {
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

    // Create subquery to get top x-axis values (same logic as original)
    const { builder: topNValuesSubquery } = await buildBaseQuery();
    topNValuesSubquery
      .select(baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]))
      .groupBy(baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]));

    // Add sorting aggregation to subquery for top N values
    const sortAggSql =
      yAxisSelections.length > 0 ? yAxisSelections[0].aggSql : 'COUNT(*)';
    topNValuesSubquery
      .select(baseModel.dbDriver.raw(`(${sortAggSql}) as sort_val`))
      .orderByRaw(`sort_val ${safeDirection}`)
      .limit(categoryLimit);

    // Now build others query excluding top N values
    othersQuery
      .select(baseModel.dbDriver.raw(`'Others' as ??`, [xAxisAlias]))
      .count('* as record_count')
      .whereRaw(`?? NOT IN (??)`, [
        baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]),
        topNValuesSubquery
          .clone()
          .clearSelect()
          .clearOrder()
          // Order by sort field query as we can't use alias
          // Alias requires us to select the column in the subquery, which we can't do as we are inside where clause
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
