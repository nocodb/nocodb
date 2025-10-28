import { formatAggregation } from 'nocodb-sdk';
import type { NcContext, NcRequest, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Filter, Model, Source, View } from '~/models';
import applyAggregation, { validateAggregationColType } from '~/db/aggregation';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';

export class GaugeCommonHandler extends BaseWidgetHandler {
  async validateWidgetData(
    context: NcContext,
    widget: WidgetType<WidgetTypes.GAUGE>,
  ) {
    const { dataSource, metric, range } = widget.config;
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
        !validateAggregationColType(context, column, metric.aggregation, false)
      ) {
        addError(
          'metric.aggregation',
          'Aggregation is not valid for this column',
        );
      }
    }

    if (!range) {
      addError('range', 'Range is required');
      return errors;
    }

    if (typeof range.min !== 'number') {
      addError('range.min', 'Range min must be a number');
    }

    if (typeof range.max !== 'number') {
      addError('range.max', 'Range max must be a number');
    }

    if (range.min >= range.max) {
      addError('range', 'Range min must be less than max');
    }

    return errors.length > 0 ? errors : undefined;
  }

  async getWidgetData(
    context: NcContext,
    params: {
      widget: WidgetType<WidgetTypes.GAUGE>;
      req: NcRequest;
    },
  ) {
    const { widget } = params;
    const { config } = widget;
    const { dataSource, metric, range } = config;

    // Get model
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

    const filters =
      dataSource === 'filter'
        ? await Filter.rootFilterListByWidget(context, {
            widgetId: widget.id,
          })
        : [];

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

    let query;
    let aggregationColumn;

    if (metric.type === 'count') {
      query = qb.count('* as count');
    } else {
      aggregationColumn = await Column.get(context, {
        colId: metric.column_id,
      });
      const aggSql = await applyAggregation({
        baseModelSqlv2: baseModel,
        aggregation: metric.aggregation,
        column: aggregationColumn,
        alias: 'count',
      });
      query = qb.select(baseModel.dbDriver.raw(aggSql));
    }

    const data = await baseModel.execAndParse(query, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
      first: true,
    });

    let value = data.count;
    if (metric.type === 'summary') {
      value = formatAggregation(
        metric.aggregation,
        data.count,
        aggregationColumn,
      );
    }

    // Calculate percentage based on range
    const percentage = Math.min(
      100,
      Math.max(
        0,
        ((Number(data.count) - range.min) / (range.max - range.min)) * 100,
      ),
    );

    return {
      data: {
        value,
        percentage,
        range,
      },
    };
  }

  async serializeOrDeserializeWidget(
    context: NcContext,
    widget: WidgetType<WidgetTypes.GAUGE>,
    idMap: Map<string, string>,
    mode: 'serialize' | 'deserialize' = 'serialize',
  ) {
    const initSerialized = await super.serializeOrDeserializeWidget(
      context,
      widget,
      idMap,
      mode,
    );
    return {
      ...initSerialized,
      config: {
        ...widget.config,
        metric: {
          ...widget.config.metric,
          column_id: widget.config.metric.column_id
            ? idMap.get(widget.config.metric.column_id)
            : null,
        },
      },
    } as any;
  }
}
