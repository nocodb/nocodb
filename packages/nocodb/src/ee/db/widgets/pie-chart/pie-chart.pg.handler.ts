import { ChartTypes, formatAggregation } from 'nocodb-sdk';
import type { NcRequest, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { PieChartCommonHandler } from '~/db/widgets/pie-chart/pie-chart.common.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';
export class PieChartPgHandler extends PieChartCommonHandler {
  async getWidgetData(params: {
    widget: WidgetType<WidgetTypes.CHART>;
    req: NcRequest;
  }) {
    const { widget, req } = params;
    const context = req.context;
    const { config } = widget;

    if (!config.chartType || config.chartType !== ChartTypes.PIE) {
      return { data: [] };
    }

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

    const filters = await Filter.rootFilterListByWidget(context, {
      widgetId: widget.id,
    });

    const categoryColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: categoryColumn,
      context: req.context,
    });

    let aggregationColumn = null;
    const aggregationAlias = 'value';

    const subQuery = baseModel.dbDriver(baseModel.tnPath);

    await baseModel.applySortAndFilter({
      table: model,
      qb: subQuery,
      filters,
      view,
      skipSort: true,
      sort: '',
      where: '',
    });

    if (!chartData.category?.includeEmptyRecords) {
      await conditionV2(
        baseModel,
        {
          fk_column_id: categoryColumn.id,
          comparison_op: 'notempty',
        },
        subQuery,
      );
    }

    subQuery.groupBy(categoryColumnNameQuery);
    subQuery.select(
      baseModel.dbDriver.raw('?? as ??', [categoryColumnNameQuery, 'category']),
    );

    subQuery.count('* as record_count');

    let aggregationExpression = '';
    if (chartData.value.type === 'count') {
      subQuery.count(`* as ${aggregationAlias}`);
      aggregationExpression = 'COUNT(*)';
    } else if (chartData.value.type === 'summary') {
      aggregationColumn = await Column.get(context, {
        colId: chartData.value.column_id,
      });

      const aggSql = await applyAggregation({
        baseModelSqlv2: baseModel,
        aggregation: chartData.value.aggregation as unknown as string,
        column: aggregationColumn,
        alias: aggregationAlias,
      });

      subQuery.select(baseModel.dbDriver.raw(aggSql));

      // Extract the expression part (everything before 'AS')
      const aggParts = aggSql.split(' AS ');
      aggregationExpression = aggParts[0];
    }

    // Add row number for ranking
    if (chartData.category.orderBy === 'asc') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY ?? ASC) as rn`, [
          categoryColumnNameQuery,
        ]),
      );
    } else if (chartData.category.orderBy === 'desc') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY ?? DESC) as rn`, [
          categoryColumnNameQuery,
        ]),
      );
    } else {
      // Default: order by aggregation expression DESC
      subQuery.select(
        baseModel.dbDriver.raw(
          `ROW_NUMBER() OVER (ORDER BY ${aggregationExpression} DESC) as rn`,
        ),
      );
    }

    // Main query that uses the subquery
    const mainQuery = baseModel.dbDriver
      .select('*')
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= 20 THEN category
          ELSE 'Others'
        END as final_category
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= 20 THEN ${aggregationAlias}
          ELSE 0
        END as final_value
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn > 20 THEN ${aggregationAlias}
          ELSE 0
        END as others_value
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= 20 THEN record_count
          ELSE 0
        END as final_count
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn > 20 THEN record_count
          ELSE 0
        END as others_count
      `),
      )
      .from(baseModel.dbDriver.raw(`(${subQuery.toString()}) as ranked_data`));

    // Final aggregation
    const finalQuery = baseModel.dbDriver
      .select('final_category as category')
      .select(
        baseModel.dbDriver.raw('SUM(final_value) + SUM(others_value) as value'),
      )
      .select(
        baseModel.dbDriver.raw('SUM(final_count) + SUM(others_count) as count'),
      )
      .from(
        baseModel.dbDriver.raw(`(${mainQuery.toString()}) as categorized_data`),
      )
      .groupBy('final_category')
      .having(
        baseModel.dbDriver.raw('SUM(final_value) + SUM(others_value) > 0'),
      );

    // Apply ordering based on category orderBy setting
    if (chartData.category.orderBy === 'asc') {
      finalQuery.orderBy('final_category', 'ASC');
    } else if (chartData.category.orderBy === 'desc') {
      finalQuery.orderBy('final_category', 'DESC');
    } else {
      // Default: order by value DESC (current behavior)
      finalQuery.orderBy('value', 'DESC');
    }

    const rawData = await baseModel.execAndParse(finalQuery, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    const formattedData = rawData.map((row: any) => {
      const value = row.value;
      let formattedValue = value;

      if (chartData.value.type === 'summary' && aggregationColumn) {
        formattedValue = formatAggregation(
          chartData.value.aggregation,
          value,
          aggregationColumn,
        );
      }

      return {
        name: row.category || 'Unknown',
        value: value || 0,
        formattedValue: formattedValue,
        count: row.count || 0,
        category: row.category,
      };
    });

    return {
      data: formattedData,
      category_column: categoryColumn.title,
      value_column: aggregationColumn?.title || null,
    };
  }
}
