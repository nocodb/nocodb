import { ChartTypes, WidgetTypes } from 'nocodb-sdk';
import type { NcContext, NcRequest, WidgetType } from 'nocodb-sdk';
import { MetricCommonHandler } from '~/db/widgets/metric/metric.common.handler';
import { NcError } from '~/helpers/ncError';
import { Model, Source } from '~/models';
import { CircularChartPgHandler } from '~/db/widgets/circular-chart/circular-chart.pg.handler';
import { CircularChartMysqlHandler } from '~/db/widgets/circular-chart/circular-chart.mysql.handler';
import { CircularChartCommonHandler } from '~/db/widgets/circular-chart/circular-chart.common.handler';
import { XyChartPgHandler } from '~/db/widgets/xy-chart/xy-chart.pg.handler';
import { XyChartMysqlHandler } from '~/db/widgets/xy-chart/xy-chart.mysql.handler';
import { XyChartCommonHandler } from '~/db/widgets/xy-chart/xy-chart.common.handler';
import { BaseWidgetHandler } from '~/db/widgets/base-widget.handler';

export async function getWidgetHandler(
  context: NcContext,
  params: {
    widget: WidgetType;
    req: NcRequest;
    idMap?: Map<string, string>;
  },
) {
  const { widget, idMap } = params;

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
          if (source?.type === 'pg') {
            return new CircularChartPgHandler();
          } else if (['mysql', 'mysql2'].includes(source?.type)) {
            return new CircularChartMysqlHandler();
          }
          return new CircularChartCommonHandler();
        case ChartTypes.BAR:
        case ChartTypes.LINE:
        case ChartTypes.SCATTER:
          if (source?.type === 'pg') {
            return new XyChartPgHandler();
          } else if (['mysql', 'mysql2'].includes(source?.type)) {
            return new XyChartMysqlHandler();
          }
          return new XyChartCommonHandler();
        default:
          return new BaseWidgetHandler();
      }
    default:
      return new BaseWidgetHandler();
  }
}

export async function getWidgetData(
  context: NcContext,
  params: {
    widget: WidgetType;
    req: NcRequest;
  },
) {
  const { widget, req } = params;

  const handler = await getWidgetHandler(context, { widget, req });

  const errors = await handler.validateWidgetData(context, widget as any);

  if (errors?.length > 0) {
    NcError.badRequest('Widget validation failed');
  }

  return await handler.getWidgetData(context, {
    widget: widget as any,
    req,
  });
}
