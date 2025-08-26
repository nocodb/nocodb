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

    // Get models and columns
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

    // Build base query with common filters
    const buildBaseQuery = () => {
      const query = baseModel.dbDriver(baseModel.tnPath);
      baseModel.applySortAndFilter({
        table: model,
        qb: query,
        filters,
        view,
        skipSort: true,
        sort: '',
        where: '',
      });

      // Filter empty records if not checkbox and not including empties
      if (
        !chartData.xAxis?.includeEmptyRecords &&
        xAxisColumn.uidt !== UITypes.Checkbox
      ) {
        conditionV2(
          baseModel,
          {
            fk_column_id: xAxisColumn.id,
            comparison_op: 'notblank',
          },
          query,
        );
      }

      return query;
    };

    // Get X-axis column name query
    const xAxisColumnNameQuery = await getColumnNameQuery({
      baseModelSqlv2: baseModel,
      column: xAxisColumn,
      context: context,
    });

    // Build Y-axis aggregations - we support multiple Y-axis fields and each field can have different aggregation
    const yAxisSelections = await Promise.all(
      chartData.yAxis.fields.map(async (field, i) => {
        const aggSql = await applyAggregation({
          baseModelSqlv2: baseModel,
          aggregation: field.aggregation as unknown as any,
          column: yAxisColumns[i],
        });
        return { alias: `y_axis_${i}`, aggSql, field };
      }),
    );

    // Build top 10 query
    const top10Query = buildBaseQuery();
    const xAxisAlias = 'x_axis';

    top10Query
      .select(
        baseModel.dbDriver.raw(`(??) as ??`, [
          xAxisColumnNameQuery.builder,
          xAxisAlias,
        ]),
      )
      .groupBy(xAxisAlias)
      .count('* as record_count');

    // Add Y-axis aggregations to top 10 query
    yAxisSelections.forEach(({ alias, aggSql }) => {
      top10Query.select(baseModel.dbDriver.raw(`(${aggSql}) as ??`, [alias]));
    });

    // Determine sort field and direction
    // If order by is default, sort by record count in descending order
    // If order by is custom, sort by custom field in ascending order
    const orderDirection = (
      chartData.xAxis.orderBy === 'default'
        ? 'desc'
        : chartData.xAxis.orderBy ?? 'desc'
    ).toUpperCase();
    // If sort by is xAxis, sort by x axis alias
    // If sort by is yAxis and only one y axis field, sort by that field
    // If sort by is yAxis and multiple y axis fields, sort by first y axis field
    // If sort by is undefined, sort by x axis alias
    const sortField =
      chartData.xAxis.sortBy === 'xAxis'
        ? xAxisAlias
        : chartData.xAxis.sortBy === 'yAxis' && yAxisSelections.length === 1
        ? yAxisSelections[0].alias
        : yAxisSelections[0]?.alias || xAxisAlias;

    // Get Plain Query for sort field - To use in others sub query, as we can't use alias
    const sortFieldQuery =
      chartData.xAxis.sortBy === 'yAxis' && yAxisSelections.length >= 1
        ? baseModel.dbDriver.raw(yAxisSelections[0].aggSql)
        : xAxisColumnNameQuery.builder;

    // Order by sort field and limit to max widget category count
    top10Query
      .orderByRaw(baseModel.dbDriver.raw(`?? ${orderDirection}`, [sortField]))
      .limit(this.MAX_WIDGET_CATEGORY_COUNT);

    // Execute top 10 query
    const top10Data = await baseModel.execAndParse(top10Query, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    // Build and execute others query only if includeOthers is true
    let othersData = [];
    if (chartData.xAxis?.includeOthers) {
      const othersQuery = buildBaseQuery();

      // Create subquery to get top x-axis values (same logic as original)
      const top10ValuesSubquery = buildBaseQuery();
      top10ValuesSubquery
        .select(baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]))
        .groupBy(baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]));

      // Add sorting aggregation to subquery for top 10 values
      const sortAggSql =
        yAxisSelections.length > 0 ? yAxisSelections[0].aggSql : 'COUNT(*)';
      top10ValuesSubquery
        .select(baseModel.dbDriver.raw(`(${sortAggSql}) as sort_val`))
        .orderByRaw(`sort_val ${orderDirection}`)
        .limit(this.MAX_WIDGET_CATEGORY_COUNT);

      // Now build others query excluding top 10 values
      othersQuery
        .select(baseModel.dbDriver.raw(`'Others' as ??`, [xAxisAlias]))
        .count('* as record_count')
        .whereRaw(`?? NOT IN (??)`, [
          baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]),
          top10ValuesSubquery
            .clone()
            .clearSelect()
            .clearOrder()
            // Order by sort field query as we can't use alias
            // Alias requires us to select the column in the subquery, which we can't do as we are inside where clause
            .orderByRaw(
              baseModel.dbDriver.raw(`(??) ${orderDirection}`, [
                sortFieldQuery,
              ]),
            )
            .select(
              baseModel.dbDriver.raw(`??`, [xAxisColumnNameQuery.builder]),
            ),
        ]);

      // Add Y-axis aggregations for others query
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

    // Combine results
    const rawData = [...top10Data];
    if (othersData.length > 0 && othersData[0].record_count > 0) {
      rawData.push(othersData[0]);
    }

    const categories = [];
    const series = yAxisColumns.map((col) => ({ name: col.title, data: [] }));

    for (const row of rawData) {
      const isOthersRow = row.x_axis === 'Others';

      let formattedXAxis;
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

      // Process each Y-axis series
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
          // Add count information
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
}
