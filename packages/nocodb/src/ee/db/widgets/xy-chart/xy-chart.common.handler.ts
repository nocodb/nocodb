import { ChartTypes, formatAggregation, UITypes } from 'nocodb-sdk';
import type {
  BarChartConfig,
  ChartWidgetType,
  LineChartConfig,
  NcContext,
  NcRequest,
  ScatterPlotConfig,
  Widget,
  WidgetType,
  WidgetTypes,
} from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Knex } from '~/db/CustomKnex';
import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';
import { Column, Filter, Model, Source, View } from '~/models';
import { validateAggregationColType } from '~/db/aggregation';
import applyAggregation from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import conditionV2 from '~/db/conditionV2';

export class XyChartCommonHandler extends BaseWidgetHandler {
  protected MAX_WIDGET_CATEGORY_COUNT = 10;

  async validateWidgetData(
    context: NcContext,
    widget: WidgetType<WidgetTypes.CHART>,
  ) {
    const errors = [];

    const addError = (path: string, message: string) => {
      errors.push({ path, message });
    };

    if (
      ![ChartTypes.BAR, ChartTypes.LINE, ChartTypes.SCATTER].includes(
        widget.config.chartType,
      )
    ) {
      addError('chartType', 'Chart type must be bar, line, or scatter');
      return errors;
    }

    const { dataSource, data } = widget.config as
      | BarChartConfig
      | LineChartConfig
      | ScatterPlotConfig;

    if (!widget?.fk_model_id) {
      addError('widget.fk_model_id', 'Model ID is required');
      return errors;
    }

    const model = await Model.getByIdOrName(context, {
      id: widget.fk_model_id,
    });
    if (!model) {
      addError('widget.fk_model_id', 'Model not found');
      return errors;
    }

    if (dataSource === 'view' && widget.fk_view_id) {
      const view = await View.get(context, widget.fk_view_id);
      if (!view || view.fk_model_id !== widget.fk_model_id) {
        addError('widget.fk_view_id', 'View not found');
      }
    }

    if (!data) {
      addError('data', 'Data is required');
      return errors;
    }

    const { xAxis, yAxis } = data;

    // Validate X-Axis
    if (!xAxis) {
      addError('data.xAxis', 'X-Axis is required');
      return errors;
    }

    if (!xAxis.column_id) {
      addError('data.xAxis.column_id', 'X-Axis column ID is required');
      return errors;
    }

    const xAxisColumn = await Column.get(context, {
      colId: xAxis.column_id,
    });

    if (!xAxisColumn) {
      addError('data.xAxis.column_id', 'X-Axis column not found');
      return errors;
    }

    if (xAxis.orderBy && !['default', 'asc', 'desc'].includes(xAxis.orderBy)) {
      addError(
        'data.xAxis.orderBy',
        'X-Axis order by must be default, asc or desc',
      );
    }

    if (xAxis.sortBy && !['xAxis', 'yAxis'].includes(xAxis.sortBy)) {
      addError('data.xAxis.sortBy', 'X-Axis sort by must be xAxis or yAxis');
    }

    // Validate Y-Axis
    if (!yAxis) {
      addError('data.yAxis', 'Y-Axis is required');
      return errors;
    }

    if (
      !yAxis.fields ||
      !Array.isArray(yAxis.fields) ||
      yAxis.fields.length === 0
    ) {
      addError('data.yAxis.fields', 'Y-Axis fields are required');
      return errors;
    }

    // Validate each Y-Axis field
    for (let i = 0; i < yAxis.fields.length; i++) {
      const field = yAxis.fields[i];
      const fieldPath = `data.yAxis.fields[${i}]`;

      if (!field.column_id) {
        addError(
          `${fieldPath}.column_id`,
          'Y-Axis field column ID is required',
        );
        continue;
      }

      const yAxisColumn = await Column.get(context, {
        colId: field.column_id,
      });

      if (!yAxisColumn || yAxisColumn.fk_model_id !== widget.fk_model_id) {
        addError(`${fieldPath}.column_id`, 'Y-Axis field column not found');
        continue;
      }

      if (!field.aggregation) {
        addError(
          `${fieldPath}.aggregation`,
          'Y-Axis field aggregation is required',
        );
        continue;
      }

      if (
        !validateAggregationColType(
          context,
          yAxisColumn,
          field.aggregation as unknown as string,
          false,
        )
      ) {
        addError(
          `${fieldPath}.aggregation`,
          'Aggregation is not valid for this column',
        );
      }
    }

    // Validate groupBy field if present
    if (yAxis.groupBy) {
      const groupByColumn = await Column.get(context, {
        colId: yAxis.groupBy,
      });

      if (!groupByColumn || groupByColumn.fk_model_id !== widget.fk_model_id) {
        addError('data.yAxis.groupBy', 'Group by column not found');
      }
    }

    return errors.length > 0 ? errors : undefined;
  }

  protected applyOrderBy(
    _query: Knex.QueryBuilder,
    _sortField: string,
    _orderDirection: string,
  ) {}
  protected buildOthersQuery(
    baseModel: IBaseModelSqlV2,
    _buildBaseQuery: () => Knex.QueryBuilder,
    _xAxisColumnNameQuery: {
      builder: string | Knex.QueryBuilder;
    },
    _xAxisAlias: string,
    _yAxisSelections: Array<{
      alias: string;
      aggSql: string;
      field: {
        column_id: string;
        aggregation: any;
      };
    }>,
    _sortFieldQuery: string | Knex.QueryBuilder | Knex.Raw,
    _orderDirection: string,
  ): Knex.QueryBuilder {
    return baseModel.dbDriver.select(`'ERR'`);
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
        baseModel.dbDriver.raw('(??) as ??', [
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

    // Order by sort field and limit to max widget category count (database-specific)
    this.applyOrderBy(top10Query, sortField, orderDirection);
    top10Query.limit(this.MAX_WIDGET_CATEGORY_COUNT);

    // Execute top 10 query
    const top10Data = await baseModel.execAndParse(top10Query, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
    });

    // Build and execute others query only if includeOthers is true
    let othersData = [];
    if (chartData.xAxis?.includeOthers) {
      const othersQuery = this.buildOthersQuery(
        baseModel,
        buildBaseQuery,
        xAxisColumnNameQuery,
        xAxisAlias,
        yAxisSelections,
        sortFieldQuery,
        orderDirection,
      );

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

  async serializeOrDeserializeWidget(
    context: NcContext,
    widget: WidgetType<WidgetTypes.CHART>,
    idMap: Map<string, string>,
    mode: 'serialize' | 'deserialize' = 'serialize',
  ) {
    const initSerialized = await super.serializeOrDeserializeWidget(
      context,
      widget,
      idMap,
      mode,
    );

    const widgetConfig = widget.config as
      | BarChartConfig
      | ScatterPlotConfig
      | LineChartConfig;

    return {
      ...initSerialized,
      config: {
        ...widgetConfig,
        data: {
          ...widgetConfig.data,
          xAxis: {
            ...widgetConfig.data.xAxis,
            column_id: widgetConfig.data.xAxis.column_id
              ? idMap.get(widgetConfig.data.xAxis.column_id) ||
                widgetConfig.data.xAxis.column_id
              : null,
          },
          yAxis: {
            ...widgetConfig.data.yAxis,
            fields: widgetConfig.data.yAxis.fields.map((field) => ({
              ...field,
              column_id: field.column_id
                ? idMap.get(field.column_id) || field.column_id
                : null,
            })),
            groupBy: widgetConfig.data.yAxis.groupBy
              ? idMap.get(widgetConfig.data.yAxis.groupBy) ||
                widgetConfig.data.yAxis.groupBy
              : null,
          },
        },
      },
    } as any;
  }
}
