import type { NcContext, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Model, View } from '~/models';
import { validateAggregationColType } from '~/db/aggregation';

export class MetricCommonHandler {
  async validateWidgetData(
    context: NcContext,
    widget: WidgetType<WidgetTypes.METRIC>,
  ) {
    const { dataSource, metric } = widget.config;
    const errors = [];

    const addError = (path: string, message: string) => {
      errors.push({ path, message });
    };

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

    if (!metric) {
      addError('metric', 'Metric is required');
      return errors;
    }

    if (!['count', 'summary'].includes(metric.type)) {
      addError('metric.type', 'Metric type must be count or summary');
    }

    if (metric.type === 'summary') {
      if (!metric.column_id) {
        addError(
          'metric.column_id',
          'Column ID is required for summary metric',
        );
        return errors;
      }

      if (!metric.aggregation) {
        addError(
          'metric.aggregation',
          'Aggregation is required for summary metric',
        );
        return errors;
      }

      const column = await Column.get(context, { colId: metric.column_id });
      if (!column) {
        addError('metric.column_id', 'Column not found');
      } else if (
        !validateAggregationColType(column, metric.aggregation, false)
      ) {
        addError(
          'metric.aggregation',
          'Aggregation is not valid for this column',
        );
      }
    }

    return errors.length > 0 ? errors : undefined;
  }
}
