import { ChartTypes } from 'nocodb-sdk';
import type { NcContext, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Model, View } from '~/models';
import { validateAggregationColType } from '~/db/aggregation';

export class PieChartCommonHandler {
  async validateWidgetData(
    context: NcContext,
    widget: WidgetType<WidgetTypes.CHART>,
  ) {
    const errors = [];

    const addError = (path: string, message: string) => {
      errors.push({ path, message });
    };

    if (widget.config.chartType !== ChartTypes.PIE) {
      addError('chartType', 'Chart type must be pie');
      return errors;
    }

    const { dataSource, data } = widget.config;

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
      if (!view) {
        addError('widget.fk_view_id', 'View not found');
      }
    }

    if (!data) {
      addError('data', 'Data is required');
      return errors;
    }

    const { category, value } = data;

    if (!category) {
      addError('data.category', 'Category is required');
      return errors;
    }

    if (!value) {
      addError('data.value', 'Value is required');
      return errors;
    }

    if (!category.column_id) {
      addError('data.category.column_id', 'Column ID is required');
      return errors;
    }

    const categoryColumn = await Column.get(context, {
      colId: category.column_id,
    });

    if (!categoryColumn) {
      addError('data.category.column_id', 'Column not found');
      return errors;
    }

    if (
      category.orderBy &&
      !['default', 'asc', 'desc'].includes(category.orderBy)
    ) {
      addError(
        'data.category.orderBy',
        'Order by must be default, asc or desc',
      );
    }

    if (!value.type) {
      addError('data.value.type', 'Value type is required');
      return errors;
    }

    if (!['count', 'summary'].includes(value.type)) {
      addError('data.value.type', 'Value type must be count or summary');
    }

    if (value.type === 'summary') {
      if (!value.column_id) {
        addError(
          'data.value.column_id',
          'Column ID is required for summary type',
        );
        return errors;
      }

      const column = await Column.get(context, { colId: value.column_id });
      if (!column) {
        addError('data.value.column_id', 'Column not found');
      } else if (
        !validateAggregationColType(
          context,
          column,
          value.aggregation as unknown as string,
          false,
        )
      ) {
        addError(
          'data.value.aggregation',
          'Aggregation is not valid for this column',
        );
      }
    }

    return errors.length > 0 ? errors : undefined;
  }
}
