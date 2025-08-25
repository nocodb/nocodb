import { ChartTypes } from 'nocodb-sdk';
import type {
  BarChartConfig,
  LineChartConfig,
  NcContext,
  ScatterPlotConfig,
  WidgetType,
  WidgetTypes,
} from 'nocodb-sdk';
import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';
import { Column, Model, View } from '~/models';
import { validateAggregationColType } from '~/db/aggregation';

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
