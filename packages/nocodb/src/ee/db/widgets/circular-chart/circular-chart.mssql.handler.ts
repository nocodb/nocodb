import {
  formatAggregation,
  NumericalAggregations,
  UITypes,
  validateAggregationColType,
} from 'nocodb-sdk';
import type {
  ChartTypes,
  ChartWidgetType,
  NcContext,
  NcRequest,
  Widget,
} from 'nocodb-sdk';
import type { Knex } from '~/db/CustomKnex';
import { CircularChartCommonHandler } from '~/db/widgets/circular-chart/circular-chart.common.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';

/**
 * MSSQL circular-chart handler.
 *
 * Two T-SQL restrictions drive the structural differences from PG/MySQL:
 *
 *  1. GROUP BY rejects SELECT-list aliases and expressions containing a
 *     scalar subquery — so the PG/MySQL idiom of `groupBy(rawCategoryExpr)`
 *     fails for virtual columns (Formula / Lookup / Rollup / Links / LTAR)
 *     whose expression is itself a subquery.
 *  2. Aggregating directly over a correlated subquery raises error 130:
 *     "Cannot perform an aggregate function on an expression containing an
 *     aggregate or a subquery". So even when GROUP BY is happy, `SUM((sub))`
 *     blows up for virtual value columns.
 *
 *  Additionally, PERCENTILE_CONT (median) is window-only in T-SQL — it
 *  cannot be used as a per-group aggregate inside a GROUP BY SELECT.
 *
 * Fix:
 *  - Always materialize the category and the value column into a derived
 *    table with stable physical aliases. The outer aggregation runs over
 *    real columns, so GROUP BY and aggregate functions both reference plain
 *    columns of the derived FROM.
 *  - For median, insert a middle layer that pre-computes the per-category
 *    median via `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value)
 *    OVER (PARTITION BY category)`. The outer aggregation uses
 *    `MAX(_nc_median)` to dedupe (all rows in a partition share the same
 *    median value).
 *  - The "Others" bucket rolls up multiple categories — summing per-category
 *    medians is NOT the median of all those rows. When `includeOthers` is
 *    on, the Others bucket's median is recomputed via a follow-up scalar
 *    query over the actual Others-scope rows and patched into the result.
 */
export class CircularChartMssqlHandler extends CircularChartCommonHandler {
  /**
   * MAX expression for the category type used during the Others rollup.
   * Unlike PG (which uses BOOL_OR for the boolean type), MSSQL stores
   * Checkbox columns as BIT — MAX over BIT works directly and returns BIT.
   */
  private getMaxExpressionForColumn(_column: Column): string {
    return 'MAX(original_category)';
  }

  async getWidgetData(
    context: NcContext,
    params: {
      widget:
        | Widget<ChartWidgetType, ChartTypes.PIE>
        | Widget<ChartWidgetType, ChartTypes.DONUT>;
      req: NcRequest;
    },
  ) {
    const { widget } = params;
    const { config } = widget;

    const { dataSource, data: chartData } = config;

    const model = await Model.getByIdOrName(context, {
      id: widget.fk_model_id,
    });

    let view = null;
    if (dataSource === 'view' && widget.fk_view_id) {
      view = await View.get(context, widget.fk_view_id);
    }
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const categoryColumn = await Column.get(context, {
      colId: chartData.category.column_id,
    });

    const filters =
      dataSource === 'filter'
        ? await Filter.rootFilterListByWidget(context, {
            widgetId: widget.id,
          })
        : [];

    const categoryColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: categoryColumn,
      context: context,
    });

    let aggregationColumn: Column | null = null;
    let aggColumnNameBuilder: string | Knex.QueryBuilder | null = null;

    if (chartData.value.type === 'summary') {
      aggregationColumn = await Column.get(context, {
        colId: chartData.value.column_id,
      });
      aggColumnNameBuilder = (
        await getColumnNameQuery({
          baseModelSqlv2: baseModel,
          column: aggregationColumn,
          context,
        })
      ).builder;
    }

    const isMedianAgg =
      chartData.value.type === 'summary' &&
      (chartData.value.aggregation as unknown as string) ===
        NumericalAggregations.Median;

    // Physical aliases inside the derived FROM. Real columns — not
    // SELECT-list aliases — so T-SQL accepts them everywhere (GROUP BY,
    // ORDER BY, aggregate args).
    const MAT_CATEGORY = '_nc_category';
    const MAT_AGG_VALUE = '_nc_agg_value';
    const MAT_MEDIAN = '_nc_median';

    /**
     * Build the innermost filtered query with materialized category and (if
     * summary) value columns. Used both for the main pipeline and the
     * follow-up median-Others query.
     */
    const buildInnerDataQuery = async (): Promise<Knex.QueryBuilder> => {
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

      const isCheckbox = categoryColumn.uidt === UITypes.Checkbox;
      if (!chartData.category?.includeEmptyRecords && !isCheckbox) {
        await conditionV2(
          baseModel,
          {
            fk_column_id: categoryColumn.id,
            comparison_op: 'notblank',
          },
          qb,
        );
      }

      qb.select(
        baseModel.dbDriver.raw('(??) as ??', [
          categoryColumnNameQuery.builder,
          MAT_CATEGORY,
        ]),
      );
      if (aggregationColumn) {
        qb.select(
          baseModel.dbDriver.raw('(??) as ??', [
            aggColumnNameBuilder,
            MAT_AGG_VALUE,
          ]),
        );
      }

      return qb;
    };

    const dataQuery = await buildInnerDataQuery();

    // Middle layer for median: pre-compute per-category median via window
    // function on plain materialized columns. Without this, T-SQL can't
    // express per-group median (PERCENTILE_CONT is window-only).
    let aggregationSource: Knex.QueryBuilder = dataQuery;
    if (isMedianAgg) {
      aggregationSource = baseModel.dbDriver
        .select('*')
        .select(
          baseModel.dbDriver.raw(
            `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ??) OVER (PARTITION BY ??) as ??`,
            [MAT_AGG_VALUE, MAT_CATEGORY, MAT_MEDIAN],
          ),
        )
        .from(baseModel.dbDriver.raw('(??) as nc_data_inner', dataQuery));
    }

    const aggregationAlias = 'value';
    const categoryAlias = 'category';

    // Per-category aggregation. GROUP BY references MAT_CATEGORY, a real
    // column of the derived FROM — accepted by T-SQL for any column class.
    const subQuery = baseModel.dbDriver
      .select(
        baseModel.dbDriver.raw('?? as ??', [MAT_CATEGORY, categoryAlias]),
      )
      .count(`* as record_count`)
      .from(baseModel.dbDriver.raw('(??) as nc_data', aggregationSource))
      .groupBy(MAT_CATEGORY);

    let aggregationExpression = '';

    if (chartData.value.type === 'count') {
      subQuery.count(`* as ${aggregationAlias}`);
      aggregationExpression = 'COUNT(*)';
    } else if (isMedianAgg) {
      // All rows in a category share the same _nc_median value; MAX is the
      // cheapest dedupe (MIN/AVG/MAX all return the same value here).
      subQuery.select(
        baseModel.dbDriver.raw(`MAX(??) as ??`, [MAT_MEDIAN, aggregationAlias]),
      );
      aggregationExpression = `MAX(${MAT_MEDIAN})`;
    } else {
      // Per-group aggregation over the materialized value column. Calling
      // generateAggregateQuery WITHOUT baseQuery keeps `materialize` false
      // — that path emits a plain per-row aggregate expression
      // (e.g. `SUM([_nc_agg_value])`), suitable for a GROUP BY SELECT.
      // Passing baseQuery would wrap the result in a scalar subquery
      // returning a single global value — wrong for per-group aggregation.
      const aggType = validateAggregationColType(
        aggregationColumn,
        chartData.value.aggregation as unknown as string,
      );
      const aggSql = DBQueryClient.fromKnex(
        baseModel.dbDriver,
      ).generateAggregateQuery({
        column: aggregationColumn,
        baseModelSqlv2: baseModel,
        aggregation: chartData.value.aggregation as unknown as string,
        column_query: MAT_AGG_VALUE,
        parsedFormulaType: aggregationColumn.colOptions?.parsed_tree?.dataType,
        aggType:
          aggType === false || aggType === 'unknown' ? 'common' : aggType,
      });

      subQuery.select(
        baseModel.dbDriver.raw(`(${aggSql}) as ??`, [aggregationAlias]),
      );
      aggregationExpression = aggSql || 'COUNT(*)';
    }

    const safeOrderBy = this.validateOrderBy(chartData.category.orderBy);

    if (safeOrderBy === 'ASC') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY ?? ASC) as rn`, [
          MAT_CATEGORY,
        ]),
      );
    } else if (safeOrderBy === 'DESC') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY ?? DESC) as rn`, [
          MAT_CATEGORY,
        ]),
      );
    } else {
      // Default: order by aggregation expression DESC. Aggregates and
      // grouped columns are both valid in window ORDER BY here.
      subQuery.select(
        baseModel.dbDriver.raw(
          `ROW_NUMBER() OVER (ORDER BY ${aggregationExpression} DESC) as rn`,
        ),
      );
    }

    const categoryLimit = this.getCategoryLimit(config);

    // Rank → bucket top-N vs Others via CASE.
    const mainQuery = baseModel.dbDriver
      .select('*')
      .select(
        baseModel.dbDriver.raw(`
        CASE
          WHEN rn <= ${categoryLimit} THEN CAST(category AS NVARCHAR(MAX))
          ELSE 'Others'
        END as final_category
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE
          WHEN rn <= ${categoryLimit} THEN category
          ELSE NULL
        END as original_category
      `),
      )
      .select(
        baseModel.dbDriver.raw(
          `
        CASE
          WHEN rn <= ${categoryLimit} THEN ??
          ELSE 0
        END as final_value
      `,
          [aggregationAlias],
        ),
      )
      .select(
        baseModel.dbDriver.raw(
          `
        CASE
          WHEN rn > ${categoryLimit} THEN ??
          ELSE 0
        END as others_value
      `,
          [aggregationAlias],
        ),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE
          WHEN rn <= ${categoryLimit} THEN record_count
          ELSE 0
        END as final_count
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE
          WHEN rn > ${categoryLimit} THEN record_count
          ELSE 0
        END as others_count
      `),
      )
      .from(baseModel.dbDriver.raw(`(??) as ranked_data`, subQuery));

    const maxExpression = this.getMaxExpressionForColumn(categoryColumn);

    // Final rollup: collapses Others' per-category rows into a single
    // bucket. For median, the SUM(others_value) here is mathematically
    // wrong — SUM of per-category medians ≠ median of all Others rows —
    // and is recomputed via a follow-up query below.
    const finalQuery = baseModel.dbDriver
      .select({
        category: baseModel.dbDriver.raw('CAST(final_category AS NVARCHAR(MAX))'),
      })
      .select(baseModel.dbDriver.raw(`${maxExpression} as original_category`))
      .select(
        baseModel.dbDriver.raw('SUM(final_value) + SUM(others_value) as value'),
      )
      .select(
        baseModel.dbDriver.raw('SUM(final_count) + SUM(others_count) as count'),
      )
      .from(baseModel.dbDriver.raw(`(??) as categorized_data`, [mainQuery]))
      .groupBy('final_category')
      .having(
        baseModel.dbDriver.raw('SUM(final_value) + SUM(others_value) > 0'),
      );

    if (safeOrderBy === 'ASC') {
      finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} ASC`));
    } else if (safeOrderBy === 'DESC') {
      finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} DESC`));
    } else {
      finalQuery.orderBy('value', 'DESC');
    }

    const rawData = await baseModel.execAndParse(finalQuery, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    // Correct the Others bucket median: SUM of per-category medians is not
    // the median of the Others' rows. We have to recompute over the actual
    // row set. One small follow-up query suffices — PERCENTILE_CONT OVER ()
    // gives a constant; TOP 1 reads it once.
    if (isMedianAgg && chartData.category.includeOthers) {
      const othersRow = rawData.find((r) => r?.category === 'Others');
      if (othersRow && (othersRow.count ?? 0) > 0) {
        // Top-N category values — same ordering as the rank pass.
        const topCategoriesQuery = baseModel.dbDriver
          .select(baseModel.dbDriver.raw('?? as top_cat', [MAT_CATEGORY]))
          .from(baseModel.dbDriver.raw('(??) as nc_data', aggregationSource))
          .groupBy(MAT_CATEGORY);
        if (safeOrderBy === 'ASC') {
          topCategoriesQuery.orderByRaw(
            baseModel.dbDriver.raw(`?? ASC`, [MAT_CATEGORY]),
          );
        } else if (safeOrderBy === 'DESC') {
          topCategoriesQuery.orderByRaw(
            baseModel.dbDriver.raw(`?? DESC`, [MAT_CATEGORY]),
          );
        } else {
          topCategoriesQuery.orderByRaw(`${aggregationExpression} DESC`);
        }
        topCategoriesQuery.limit(categoryLimit);

        const othersMedianInner = await buildInnerDataQuery();
        const othersMedianQuery = baseModel.dbDriver
          .select(
            baseModel.dbDriver.raw(
              `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ??) OVER () as v`,
              [MAT_AGG_VALUE],
            ),
          )
          .from(baseModel.dbDriver.raw('(??) as nc_data', othersMedianInner))
          .whereNotIn(MAT_CATEGORY, topCategoriesQuery)
          .limit(1);

        const othersMedianResult = await baseModel.execAndParse(
          othersMedianQuery,
          null,
          {
            skipDateConversion: true,
            skipAttachmentConversion: true,
            skipUserConversion: true,
            first: true,
          },
        );
        othersRow.value = othersMedianResult?.v ?? 0;
      }
    }

    let formattedData = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const value = row.value;
      let formattedValue = value;
      let formattedCategory = row.category;

      if (chartData.value.type === 'summary' && aggregationColumn) {
        formattedValue = formatAggregation(
          chartData.value.aggregation,
          value,
          aggregationColumn,
        );
      }

      formattedCategory = await this.formatValue(
        context,
        row.category,
        categoryColumn,
      );

      formattedData.push({
        name: formattedCategory || 'Empty',
        value: value || 0,
        formattedValue: formattedValue,
        count: row.count || 0,
        category: row.category,
        formattedCategory: formattedCategory,
      });
    }

    if (!chartData.category.includeOthers) {
      formattedData = formattedData.filter(
        (item) => item.category !== 'Others',
      );
    }

    return {
      data: formattedData,
      category_column: categoryColumn.title,
      value_column: aggregationColumn?.title || null,
    };
  }
}
