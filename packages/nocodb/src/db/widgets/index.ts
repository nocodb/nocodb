import { WidgetTypes } from 'nocodb-sdk';
import { MetricPgHandler } from './metric/metric.pg.handler';
import type { NcRequest, WidgetType } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
import { Model, Source } from '~/models';

async function getWidgetHandler(params: {
  widget: WidgetType;
  req: NcRequest;
}) {
  const { widget, req } = params;
  const context = req.context;

  const model = await Model.getByIdOrName(context, {
    id: widget.fk_model_id,
  });

  const source = await Source.get(context, model.source_id);

  if (!['pg', 'mysql'].includes(source.type)) {
    NcError.notImplemented('Widget');
  }

  switch (widget.type) {
    case WidgetTypes.METRIC:
      return new MetricPgHandler();
    case WidgetTypes.CHART:
      switch (widget.config.chartType) {
        default:
          NcError.notImplemented('Chart widget');
      }
      break;
    default:
      NcError.badRequest(
        `Widget type ${widget.type} is not supported for data retrieval`,
      );
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
