import { MetricCommonHandler } from './metric.common.handler';
import type { NcRequest, WidgetType, WidgetTypes } from 'nocodb-sdk';
import { Column, Filter, Model, Source, View } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import applyAggregation from '~/db/aggregation';

export class MetricPgHandler extends MetricCommonHandler {
  async getWidgetData(params: {
    widget: WidgetType<WidgetTypes.METRIC>;
    req: NcRequest;
  }) {
    const { widget, req } = params;
    const context = req.context;
    const { config } = widget;
    const { dataSource, metric } = config;

    // Get model
    const model = await Model.getByIdOrName(context, {
      id: dataSource.fk_model_id,
    });

    let view = null;
    if (dataSource.type === 'view' && dataSource.fk_view_id) {
      view = await View.get(context, dataSource.fk_view_id);
    }

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const filters = await Filter.rootFilterListByWidget(context, {
      widgetId: widget.id,
    });

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

    if (metric.type === 'count') {
      query = qb.count();
    } else {
      const aggregationColumn = await Column.get(context, {
        colId: metric.column_id,
      });
      const aggSql = await applyAggregation({
        baseModelSqlv2: baseModel,
        aggregation: metric.aggregation,
        column: aggregationColumn,
        alias: 'agg',
      });

      query = qb.select(aggSql);
    }

    const data = await baseModel.execAndParse(query, null, {
      skipDateConversion: true,
      skipAttachmentConversion: true,
      skipUserConversion: true,
      first: true,
    });

    console.log(data);
    return data;
  }
}
