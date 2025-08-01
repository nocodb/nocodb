import { formatAggregation, UITypes } from 'nocodb-sdk';
import type {
  ChartTypes,
  ChartWidgetType,
  NcRequest,
  Widget,
} from 'nocodb-sdk';
import { CircularChartCommonHandler } from '~/db/widgets/circular-chart/circular-chart.common.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';

export class CircularChartPgHandler extends CircularChartCommonHandler {
  /**
   * Get the MAX function expression based on column type
   */
  private getMaxExpressionForColumn(column: Column): string {
    switch (column.uidt) {
      case UITypes.Checkbox:
        return 'BOOL_OR(original_category)';
      default:
        return 'MAX(original_category)';
    }
  }

  async getWidgetData(params: {
    widget:
      | Widget<ChartWidgetType, ChartTypes.PIE>
      | Widget<ChartWidgetType, ChartTypes.DONUT>;
    req: NcRequest;
  }) {
    const { widget, req } = params;
    const context = req.context;
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
    const categoryAlias = 'category';

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

    const isCheckbox = categoryColumn.uidt === UITypes.Checkbox;

    if (!chartData.category?.includeEmptyRecords && !isCheckbox) {
      await conditionV2(
        baseModel,
        {
          fk_column_id: categoryColumn.id,
          comparison_op: 'notblank',
        },
        subQuery,
      );
    }

    subQuery.select(
      baseModel.dbDriver.raw(`(??) as ??`, [
        categoryColumnNameQuery.builder,
        categoryAlias,
      ]),
    );

    subQuery.groupBy(categoryAlias);

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
      });

      subQuery.select(
        baseModel.dbDriver.raw(`(${aggSql}) as ??`, [aggregationAlias]),
      );
      aggregationExpression = aggSql;
    }

    // Add row number for ranking
    if (chartData.category.orderBy === 'asc') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY (??) ASC) as rn`, [
          categoryColumnNameQuery.builder,
        ]),
      );
    } else if (chartData.category.orderBy === 'desc') {
      subQuery.select(
        baseModel.dbDriver.raw(`ROW_NUMBER() OVER (ORDER BY (??) DESC) as rn`, [
          categoryColumnNameQuery.builder,
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

    // Cast TEXT to avoid type conflicts, preserve original for sorting
    const mainQuery = baseModel.dbDriver
      .select('*')
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT} THEN CAST(category AS TEXT)
          ELSE 'Others'
        END as final_category
      `),
      )
      // This is original value used for ordering
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT} THEN category
          ELSE NULL
        END as original_category
      `),
      )
      .select(
        baseModel.dbDriver.raw(
          `
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT} THEN ??
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
          WHEN rn > ${this.MAX_WIDGET_CATEGORY_COUNT} THEN ??
          ELSE 0
        END as others_value
      `,
          [aggregationAlias],
        ),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT} THEN record_count
          ELSE 0
        END as final_count
      `),
      )
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn > ${this.MAX_WIDGET_CATEGORY_COUNT} THEN record_count
          ELSE 0
        END as others_count
      `),
      )
      .from(baseModel.dbDriver.raw(`(??) as ranked_data`, subQuery));

    // Get the MAX expression for this column type
    const maxExpression = this.getMaxExpressionForColumn(categoryColumn);

    // Final aggregation
    const finalQuery = baseModel.dbDriver
      .select({ category: baseModel.dbDriver.raw('(final_category)::TEXT') })
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

    // Apply ordering - use original_category for proper sorting
    if (chartData.category.orderBy === 'asc') {
      finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} ASC`));
    } else if (chartData.category.orderBy === 'desc') {
      finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} DESC`));
    } else {
      // Default: order by value DESC
      finalQuery.orderBy('value', 'DESC');
    }

    const rawData = await baseModel.execAndParse(finalQuery, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

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
      formattedData = formattedData.filter((item) => item.category !== 'Others');
    }

    return {
      data: formattedData,
      category_column: categoryColumn.title,
      value_column: aggregationColumn?.title || null,
    };
  }
}
