import type { NcContext, NcRequest, WidgetType } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';

async function getWidgetHandler(params: {
  widget: WidgetType;
  req: NcRequest;
}) {

}

export default async function getWidgetData(params: {
  widget: WidgetType;
  req: NcRequest;
}) {
  const { widget, req } = params;
}
