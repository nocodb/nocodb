import {
  ChartTypes,
  formatAggregation,
  NumericalAggregations,
  UITypes,
  validateAggregationColType,
} from 'nocodb-sdk';
import type {
  BarChartConfig,
  ChartWidgetType,
  LineChartConfig,
  NcContext,
  NcRequest,
  ScatterPlotConfig,
  Widget,
} from 'nocodb-sdk';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { XyChartCommonHandler } from '~/db/widgets/xy-chart/xy-chart.common.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';

/**
 * MSSQL xy-chart (bar / line / scatter) handler.
 *
 * Same restriction set as the circular-chart MSSQL handler:
 *  1. GROUP BY rejects SELECT-list aliases and expressions containing a
 *     scalar subquery — breaks virtual columns (Formula / Lookup / Rollup
 *     / Links / LTAR).
 *  2. Aggregating directly over a correlated subquery raises T-SQL
 *     error 130.
 *  3. PERCENTILE_CONT (median) is window-only — cannot be used as a
 *     per-group aggregate in a GROUP BY SELECT.
 *
 * Fix:
 *  - Materialize the x-axis expression and each y-axis column into a
 *    derived table with stable physical aliases.
 *  - For y-axes whose aggregation is median, insert a middle layer that
 *    pre-computes the per-x-axis median via
 *    `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY y) OVER (PARTITION BY x)`.
 *    The outer aggregation reads `MAX(_nc_median_i)` to dedupe.
 *  - Others bucket — a single group rolling up "non-top-N" rows — gets its
 *    aggregates from a separate query. Median in Others can't be derived
 *    from the per-x-axis medians; we recompute over the actual Others
 *    rows via a follow-up `PERCENTILE_CONT OVER ()` query and patch the
 *    result.
 *
 * fully overrides `getWidgetData` from the common handler — `applyOrderBy`
 * / `buildOthersQuery` from common are not used.
 */
export class XyChartMssqlHandler extends XyChartCommonHandler {
  async getWidgetData(
    context: NcContext,
    params: {
      widget:
        | Widget<ChartWidgetType, ChartTypes.BAR>
        | Widget<ChartWidgetType, ChartTypes.LINE>
        | Widget<ChartWidgetType, ChartTypes.SCATTER>;
      req: NcRequest;
    },
  ) {
    const { widget } = params;
    const { config } = widget;
    const { dataSource, data: chartData } = config;

    const model = await Model.getByIdOrName(context, {
      id: widget.fk_model_id,
    });
    const view =
      dataSource === 'view' && widget.fk_view_id
        ? await View.get(context, widget.fk_view_id)
        : null;
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const xAxisColumn = await Column.get(context, {
      colId: chartData.xAxis.column_id,
    });
    const yAxisColumns = await Promise.all(
      chartData.yAxis.fields.map((field) =>
        Column.get(context, { colId: field.column_id }),
      ),
    );

    const filters =
      dataSource === 'filter'
        ? await Filter.rootFilterListByWidget(context, { widgetId: widget.id })
        : [];

    const xAxisColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: xAxisColumn,
      context: context,
    });

    const yAxisColumnNameQueries = await Promise.all(
      yAxisColumns.map((col) =>
        getColumnNameQuery({
          baseModelSqlv2: baseModel,
          column: col,
          context,
        }),
      ),
    );

    // Physical aliases inside the derived FROM.
    const MAT_X = '_nc_x';
    const matYAlias = (i: number) => `_nc_y${i}`;
    const matMedianAlias = (i: number) => `_nc_median_${i}`;
    const xAxisAlias = 'x_axis';

    // Indices of y-axis fields using median aggregation. Drives the middle
    // PARTITION BY layer + per-y-axis-Others-recompute path.
    const medianYIndices: number[] = chartData.yAxis.fields
      .map((f, i) =>
        (f.aggregation as unknown as string) === NumericalAggregations.Median
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    const hasMedianY = medianYIndices.length > 0;

    /**
     * Filtered base query + materialized x-axis and y-axis columns.
     */
    const buildMaterializedQuery = async (): Promise<{
      builder: Knex.QueryBuilder;
    }> => {
      const qb = baseModel.dbDriver(baseModel.tnPath);
      await baseModel.applySortAndFilter({
        table: model,
        qb,
        filters,
        view,
        skipSort: true,
        sort: '',
        where: '',
      });

      const softDeleteFilter = await baseModel.getSoftDeleteFilter();
      if (softDeleteFilter) {
        qb.where(softDeleteFilter);
      }

      if (
        !chartData.xAxis?.includeEmptyRecords &&
        xAxisColumn.uidt !== UITypes.Checkbox
      ) {
        await conditionV2(
          baseModel,
          {
            fk_column_id: xAxisColumn.id,
            comparison_op: 'notblank',
          },
          qb,
        );
      }

      qb.select(
        baseModel.dbDriver.raw('(??) as ??', [
          xAxisColumnNameQuery.builder,
          MAT_X,
        ]),
      );
      yAxisColumnNameQueries.forEach((q, i) => {
        qb.select(
          baseModel.dbDriver.raw('(??) as ??', [q.builder, matYAlias(i)]),
        );
      });

      return { builder: qb };
    };

    /**
     * Wrap a materialized query with a middle layer that adds
     * PERCENTILE_CONT(...) OVER (PARTITION BY MAT_X) columns for each
     * median y-axis field. The outer aggregation then reads
     * `MAX(_nc_median_i)` per group. When `partition` is null the median
     * is computed over the whole window (used by the Others bucket).
     */
    const wrapWithMedianLayer = (
      inner: Knex.QueryBuilder,
      partition: string | null,
    ): Knex.QueryBuilder => {
      if (!hasMedianY) return inner;
      const middle = baseModel.dbDriver
        .select('*')
        .from(baseModel.dbDriver.raw('(??) as nc_data_inner', inner));
      medianYIndices.forEach((i) => {
        if (partition) {
          middle.select(
            baseModel.dbDriver.raw(
              `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ??) OVER (PARTITION BY ??) as ??`,
              [matYAlias(i), partition, matMedianAlias(i)],
            ),
          );
        } else {
          middle.select(
            baseModel.dbDriver.raw(
              `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ??) OVER () as ??`,
              [matYAlias(i), matMedianAlias(i)],
            ),
          );
        }
      });
      return middle;
    };

    /**
     * Y-axis per-group aggregation SQL.
     *
     * - For median, the outer aggregation reads MAX(_nc_median_i) — all
     *   rows in a partition share the same median value.
     * - For everything else, generateAggregateQuery WITHOUT baseQuery
     *   emits a plain per-row aggregate expression (e.g. `SUM([_nc_y0])`)
     *   suitable for a GROUP BY SELECT. Passing baseQuery would wrap the
     *   result in a scalar subquery returning a single global value
     *   — wrong for per-group aggregation.
     */
    const buildYAggSql = (i: number): string => {
      const col = yAxisColumns[i];
      const aggregation = chartData.yAxis.fields[i]
        .aggregation as unknown as string;
      if (aggregation === NumericalAggregations.Median) {
        return `MAX(${matMedianAlias(i)})`;
      }
      const aggType = validateAggregationColType(col, aggregation);
      return (
        DBQueryClient.fromKnex(baseModel.dbDriver).generateAggregateQuery({
          column: col,
          baseModelSqlv2: baseModel,
          aggregation,
          column_query: matYAlias(i),
          parsedFormulaType: col.colOptions?.parsed_tree?.dataType,
          aggType:
            aggType === false || aggType === 'unknown' ? 'common' : aggType,
        }) || 'COUNT(*)'
      );
    };

    const yAxisSelections = chartData.yAxis.fields.map((field, i) => ({
      alias: `y_axis_${i}`,
      aggSql: buildYAggSql(i),
      field,
    }));

    // -------------------------------------------------------------------
    // Top-N x-axis values + per-group aggregations.
    // -------------------------------------------------------------------
    const { builder: topNDataInner } = await buildMaterializedQuery();
    const topNSource = wrapWithMedianLayer(topNDataInner, MAT_X);

    const topNQuery = baseModel.dbDriver
      .select(baseModel.dbDriver.raw('?? as ??', [MAT_X, xAxisAlias]))
      .count('* as record_count')
      .from(baseModel.dbDriver.raw('(??) as nc_data', topNSource))
      .groupBy(MAT_X);

    yAxisSelections.forEach(({ alias, aggSql }) => {
      topNQuery.select(baseModel.dbDriver.raw(`(${aggSql}) as ??`, [alias]));
    });

    const orderDirection =
      chartData.xAxis.orderBy === 'default' ||
      chartData.xAxis.orderBy === 'desc'
        ? 'DESC'
        : 'ASC';
    const safeDirection = orderDirection === 'ASC' ? 'ASC' : 'DESC';
    const sortField =
      chartData.xAxis.sortBy === 'xAxis'
        ? xAxisAlias
        : chartData.xAxis.sortBy === 'yAxis' && yAxisSelections.length === 1
        ? yAxisSelections[0].alias
        : yAxisSelections[0]?.alias || xAxisAlias;

    // ORDER BY by alias is fine in T-SQL (the restriction is GROUP BY only).
    topNQuery.orderByRaw(
      baseModel.dbDriver.raw(`?? ${safeDirection}`, [sortField]),
    );
    const categoryLimit = this.getCategoryLimit(config);
    topNQuery.limit(categoryLimit);

    const topNData = await baseModel.execAndParse(topNQuery, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    // -------------------------------------------------------------------
    // Others bucket — only when explicitly requested.
    // -------------------------------------------------------------------
    let othersData: Array<Record<string, any>> = [];
    if (chartData.xAxis?.includeOthers) {
      const { builder: othersDataInner } = await buildMaterializedQuery();
      const { builder: topXInner } = await buildMaterializedQuery();

      const sortAggSql =
        yAxisSelections.length > 0 ? yAxisSelections[0].aggSql : 'COUNT(*)';
      // Top-N x-axis values via a one-column subquery — used as the
      // LEFT JOIN key. Same ordering as topNQuery.
      // Note: when sortAggSql refers to MAX(_nc_median_i), it can't be
      // evaluated here because topXInner has no _nc_median_i column.
      // We fall back to ordering by the first non-median y-axis if any,
      // or by COUNT(*) otherwise — for the Others-vs-top-N split.
      const firstNonMedianAgg =
        yAxisSelections.find(
          (s, i) =>
            (chartData.yAxis.fields[i].aggregation as unknown as string) !==
            NumericalAggregations.Median,
        )?.aggSql || 'COUNT(*)';
      const topNSortAggForJoin = sortAggSql.startsWith('MAX(_nc_median_')
        ? firstNonMedianAgg
        : sortAggSql;

      topXInner
        .clearSelect()
        .select(baseModel.dbDriver.raw('?? as top_x_value', [MAT_X]))
        .groupBy(MAT_X)
        .orderByRaw(`(${topNSortAggForJoin}) ${safeDirection}`)
        .limit(categoryLimit);

      // For median y-axes, wrap the Others-scope rows with PERCENTILE_CONT
      // OVER () — global median over the (Others-filtered) set.
      const othersBase = baseModel.dbDriver
        .select('*')
        .from(baseModel.dbDriver.raw('(??) as nc_data', othersDataInner))
        .leftJoin(
          baseModel.dbDriver.raw('(??) as top_values', [topXInner]),
          baseModel.dbDriver.raw('?? = top_values.top_x_value', [MAT_X]),
        )
        .whereNull('top_values.top_x_value');

      const othersSource = wrapWithMedianLayer(othersBase, null);

      const othersQuery = baseModel.dbDriver
        .select(baseModel.dbDriver.raw(`'Others' as ??`, [xAxisAlias]))
        .count('* as record_count')
        .from(baseModel.dbDriver.raw('(??) as nc_others', othersSource));

      yAxisSelections.forEach(({ alias, aggSql }) => {
        othersQuery.select(
          baseModel.dbDriver.raw(`(${aggSql}) as ??`, [alias]),
        );
      });

      othersData = await baseModel.execAndParse(othersQuery, null, {
        skipDateConversion: true,
        skipAttachmentConversion: true,
        skipUserConversion: true,
      });
    }

    // -------------------------------------------------------------------
    // Combine + format — identical shape to the common handler.
    // -------------------------------------------------------------------
    const rawData = [...topNData];
    if (othersData.length > 0 && othersData[0].record_count > 0) {
      rawData.push(othersData[0]);
    }

    const categories: string[] = [];
    const series = yAxisColumns.map((col) => ({
      name: col.title,
      data: [] as Array<Record<string, any>>,
    }));

    for (const row of rawData) {
      const isOthersRow = row.x_axis === 'Others';

      let formattedXAxis: string;
      if (isOthersRow) {
        formattedXAxis = 'Others';
      } else {
        const formattedValue = await this.formatValue(
          context,
          row.x_axis,
          xAxisColumn,
        );
        formattedXAxis = formattedValue || 'Empty';
      }

      categories.push(formattedXAxis);

      yAxisSelections.forEach(({ alias, field }, i) => {
        const value = row[alias] || 0;
        const formattedValue = formatAggregation(
          field.aggregation,
          value,
          yAxisColumns[i],
        );

        const dataPoint = {
          value,
          formatted_value: formattedValue,
          ...(row.record_count && { count: row.record_count }),
          ...(isOthersRow && { isOthers: true }),
        };

        series[i].data.push(dataPoint);
      });
    }

    return {
      categories,
      series,
      x_axis_column: xAxisColumn.title,
      y_axis_columns: yAxisColumns.map((col) => col.title),
    };
  }

  // Common-handler hooks kept for shape compatibility — `getWidgetData` is
  // fully overridden above, so these never run for the MSSQL handler.
  protected applyOrderBy(
    _query: Knex.QueryBuilder,
    _sortField: string,
    _orderDirection: string,
  ): void {
    /* not used — MSSQL overrides getWidgetData entirely */
  }

  protected async buildOthersQuery(
    baseModel: IBaseModelSqlV2,
    _buildBaseQuery: () => Promise<{ builder: Knex.QueryBuilder }>,
    _xAxisColumnNameQuery: { builder: string | Knex.QueryBuilder },
    _xAxisAlias: string,
    _yAxisSelections: Array<{
      alias: string;
      aggSql: string;
      field: { column_id: string; aggregation: any };
    }>,
    _sortFieldQuery: string | Knex.QueryBuilder | Knex.Raw,
    _orderDirection: string,
    _categoryLimit: number,
  ): Promise<{ builder: Knex.QueryBuilder }> {
    /* not used — MSSQL overrides getWidgetData entirely */
    return { builder: baseModel.dbDriver.select(`'ERR'`) };
  }
}
