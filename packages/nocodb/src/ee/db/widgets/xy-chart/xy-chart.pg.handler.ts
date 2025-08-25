import { formatAggregation, UITypes } from 'nocodb-sdk';
import type {
  ChartTypes,
  ChartWidgetType,
  NcContext,
  NcRequest,
  Widget,
} from 'nocodb-sdk';
import { XyChartCommonHandler } from '~/db/widgets/xy-chart/xy-chart.common.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';

export class XyChartPgHandler extends XyChartCommonHandler {
  /**
   * Get the MAX function expression based on column type for ordering
   */
  private getMaxExpressionForColumn(column: Column): string {
    switch (column.uidt) {
      case UITypes.Checkbox:
        return 'BOOL_OR(original_x_axis)';
      case UITypes.Date:
      case UITypes.DateTime:
        return 'MAX(original_x_axis)';
      default:
        return 'MAX(original_x_axis)';
    }
  }

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

    // Get X-axis column
    const xAxisColumn = await Column.get(context, {
      colId: chartData.xAxis.column_id,
    });

    // Get Y-axis columns
    const yAxisColumns = await Promise.all(
      chartData.yAxis.fields.map((field) =>
        Column.get(context, { colId: field.column_id }),
      ),
    );

    const filters =
      dataSource === 'filter'
        ? await Filter.rootFilterListByWidget(context, {
            widgetId: widget.id,
          })
        : [];

    const xAxisColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: xAxisColumn,
      context: context,
    });

    const xAxisAlias = 'x_axis';
    const isCheckbox = xAxisColumn.uidt === UITypes.Checkbox;

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

    // Filter empty records if not included
    if (!chartData.xAxis?.includeEmptyRecords && !isCheckbox) {
      await conditionV2(
        baseModel,
        {
          fk_column_id: xAxisColumn.id,
          comparison_op: 'notblank',
        },
        subQuery,
      );
    }

    // Select X-axis
    subQuery.select(
      baseModel.dbDriver.raw(`(??) as ??`, [
        xAxisColumnNameQuery.builder,
        xAxisAlias,
      ]),
    );

    subQuery.groupBy(xAxisAlias);
    subQuery.count('* as record_count');

    // Add Y-axis aggregations
    const yAxisSelections = [];
    for (let i = 0; i < chartData.yAxis.fields.length; i++) {
      const field = chartData.yAxis.fields[i];
      const column = yAxisColumns[i];
      const alias = `y_axis_${i}`;

      const aggSql = await applyAggregation({
        baseModelSqlv2: baseModel,
        aggregation: field.aggregation as unknown as string,
        column: column,
      });

      subQuery.select(baseModel.dbDriver.raw(`(${aggSql}) as ??`, [alias]));

      yAxisSelections.push({ alias, aggSql, column, field });
    }

    // Determine sorting expression
    let sortExpression = '';
    if (chartData.xAxis.sortBy === 'xAxis') {
      sortExpression = xAxisColumnNameQuery.builder;
    } else if (
      chartData.xAxis.sortBy === 'yAxis' &&
      yAxisSelections.length > 0
    ) {
      // Sort by first Y-axis field
      sortExpression = yAxisSelections[0].aggSql;
    } else {
      // Default sort by x-axis
      sortExpression = xAxisColumnNameQuery.builder;
    }

    // Add row number for potential limiting
    const orderDirection =
      chartData.xAxis.orderBy === 'asc'
        ? 'ASC'
        : chartData.xAxis.orderBy === 'desc'
        ? 'DESC'
        : chartData.xAxis.sortBy === 'yAxis'
        ? 'DESC'
        : 'ASC';

    subQuery.select(
      baseModel.dbDriver.raw(
        `ROW_NUMBER() OVER (ORDER BY ${sortExpression} ${orderDirection}) as rn`,
      ),
    );

    // Cast TEXT to avoid type conflicts, preserve original for sorting
    const mainQuery = baseModel.dbDriver
      .select('*')
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= ${
            this.MAX_WIDGET_CATEGORY_COUNT || 20
          } THEN CAST(x_axis AS TEXT)
          ELSE 'Others'
        END as final_x_axis
      `),
      )
      // Original value used for ordering
      .select(
        baseModel.dbDriver.raw(`
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT || 20} THEN x_axis
          ELSE NULL
        END as original_x_axis
      `),
      );

    // Add final Y-axis selections with Others handling
    for (const selection of yAxisSelections) {
      mainQuery.select(
        baseModel.dbDriver.raw(
          `
        CASE 
          WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT || 20} THEN ??
          ELSE 0
        END as final_${selection.alias}
      `,
          [selection.alias],
        ),
      );

      mainQuery.select(
        baseModel.dbDriver.raw(
          `
        CASE 
          WHEN rn > ${this.MAX_WIDGET_CATEGORY_COUNT || 20} THEN ??
          ELSE 0
        END as others_${selection.alias}
      `,
          [selection.alias],
        ),
      );
    }

    mainQuery.select(
      baseModel.dbDriver.raw(`
      CASE 
        WHEN rn <= ${this.MAX_WIDGET_CATEGORY_COUNT || 20} THEN record_count
        ELSE 0
      END as final_count
    `),
    );

    mainQuery.select(
      baseModel.dbDriver.raw(`
      CASE 
        WHEN rn > ${this.MAX_WIDGET_CATEGORY_COUNT || 20} THEN record_count
        ELSE 0
      END as others_count
    `),
    );

    mainQuery.from(baseModel.dbDriver.raw(`(??) as ranked_data`, subQuery));

    // Get the MAX expression for this column type
    const maxExpression = this.getMaxExpressionForColumn(xAxisColumn);

    // Final aggregation
    const finalQuery = baseModel.dbDriver
      .select({ x_axis: baseModel.dbDriver.raw('(final_x_axis)::TEXT') })
      .select(baseModel.dbDriver.raw(`${maxExpression} as original_x_axis`))
      .select(
        baseModel.dbDriver.raw(
          'SUM(final_count) + SUM(others_count) as total_count',
        ),
      );

    // Add aggregated Y-axis values
    for (const selection of yAxisSelections) {
      finalQuery.select(
        baseModel.dbDriver.raw(
          `SUM(final_${selection.alias}) + SUM(others_${selection.alias}) as ${selection.alias}`,
        ),
      );
    }

    finalQuery
      .from(baseModel.dbDriver.raw(`(??) as categorized_data`, [mainQuery]))
      .groupBy('final_x_axis');

    // Apply final ordering
    if (chartData.xAxis.sortBy === 'xAxis') {
      if (chartData.xAxis.orderBy === 'asc') {
        finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} ASC`));
      } else if (chartData.xAxis.orderBy === 'desc') {
        finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} DESC`));
      } else {
        finalQuery.orderByRaw(baseModel.dbDriver.raw(`${maxExpression} ASC`));
      }
    } else if (
      chartData.xAxis.sortBy === 'yAxis' &&
      yAxisSelections.length > 0
    ) {
      const firstYAxis = yAxisSelections[0].alias;
      if (chartData.xAxis.orderBy === 'asc') {
        finalQuery.orderBy(firstYAxis, 'ASC');
      } else {
        finalQuery.orderBy(firstYAxis, 'DESC');
      }
    }

    const rawData = await baseModel.execAndParse(finalQuery, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    // Format the response
    const categories = [];
    const series = [];

    // Initialize series array
    for (let i = 0; i < yAxisColumns.length; i++) {
      const column = yAxisColumns[i];
      const field = chartData.yAxis.fields[i];

      series.push({
        name: column.title,
        data: [],
      });
    }

    // Process data
    for (const row of rawData) {
      // Format x-axis category
      const formattedXAxis = await this.formatValue(
        context,
        row.x_axis,
        xAxisColumn,
      );

      categories.push(formattedXAxis || 'Empty');

      // Process each Y-axis series
      for (let i = 0; i < yAxisColumns.length; i++) {
        const column = yAxisColumns[i];
        const field = chartData.yAxis.fields[i];
        const alias = `y_axis_${i}`;
        const value = row[alias] || 0;

        const formattedValue = formatAggregation(
          field.aggregation,
          value,
          column,
        );

        series[i].data.push({
          value: value,
          formatted_value: formattedValue,
        });
      }
    }

    return {
      categories,
      series,
      x_axis_column: xAxisColumn.title,
      y_axis_columns: yAxisColumns.map((col) => col.title),
    };
  }
}
