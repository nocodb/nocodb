import { ChartTypes, WidgetTypes } from 'nocodb-sdk';
import type { NcRequest, WidgetType } from 'nocodb-sdk';
import { MetricCommonHandler } from '~/db/widgets/metric/metric.common.handler';
import { NcError } from '~/helpers/ncError';
import { Model, Source } from '~/models';
import { CircularChartPgHandler } from '~/db/widgets/circular-chart/circular-chart.pg.handler';

export async function getWidgetHandler(params: {
  widget: WidgetType;
  req: NcRequest;
  idMap?: Map<string, string>;
}) {
  const { widget, req, idMap } = params;
  const context = req.context;

  const modelId = idMap?.get(widget.fk_model_id) || widget.fk_model_id;

  const model = await Model.getByIdOrName(context, {
    id: modelId,
  });
  const source = await Source.get(context, model.source_id);

  if (!['pg', 'mysql'].includes(source.type)) {
    NcError.notImplemented('Widget');
  }

  switch (widget.type) {
    case WidgetTypes.METRIC:
      return new MetricCommonHandler();
    case WidgetTypes.CHART:
      switch (widget.config.chartType) {
        case ChartTypes.PIE:
        case ChartTypes.DONUT:
          if (source.type !== 'pg') {
            NcError.notImplemented('Widget');
          }
          return new CircularChartPgHandler();
        default:
          NcError.notImplemented('Chart widget');
      }
      break;
    default:
      NcError.notImplemented(`${widget.type} widget`);
  }
}

export async function getWidgetData(params: {
  widget: WidgetType;
  req: NcRequest;
}) {
  const { widget, req } = params;

  const handler = await getWidgetHandler({ widget, req });

  const errors = await handler.validateWidgetData(req.context, widget as any);

  if (errors?.length > 0) {
    NcError.badRequest('Widget validation failed');
  }

  return await handler.getWidgetData({
    widget: widget as any,
    req,
  });
}
