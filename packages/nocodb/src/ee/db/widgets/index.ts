import { ChartTypes, WidgetTypes } from 'nocodb-sdk';
import type { NcRequest, WidgetType } from 'nocodb-sdk';
import { MetricCommonHandler } from '~/db/widgets/metric/metric.common.handler';
import { NcError } from '~/helpers/ncError';
import { Model, Source } from '~/models';
import { CircularChartPgHandler } from '~/db/widgets/circular-chart/circular-chart.pg.handler';
import { CircularChartCommonHandler } from '~/db/widgets/circular-chart/circular-chart.common.handler';
import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';

export async function getWidgetHandler(params: {
  widget: WidgetType;
  req: NcRequest;
  idMap?: Map<string, string>;
}) {
  const { widget, req, idMap } = params;
  const context = req.context;

  const modelId = idMap?.get(widget.fk_model_id) || widget.fk_model_id;

  const model =
    modelId &&
    (await Model.getByIdOrName(context, {
      id: modelId,
    }));
  const source = model && (await Source.get(context, model.source_id));

  switch (widget.type) {
    case WidgetTypes.METRIC:
      return new MetricCommonHandler();
    case WidgetTypes.CHART:
      switch (widget.config.chartType) {
        case ChartTypes.PIE:
        case ChartTypes.DONUT:
          if (source?.type !== 'pg') {
            return new CircularChartCommonHandler();
          }
          return new CircularChartPgHandler();
        default:
          return new BaseWidgetHandler();
      }
    default:
      return new BaseWidgetHandler();
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
