import type { NcContext, NcRequest, WidgetType } from 'nocodb-sdk';

export class BaseWidgetHandler {
  async validateWidgetData(_context: NcContext, _widgetData: WidgetType) {}

  async getWidgetData(_params: { widget: WidgetType; req: NcRequest }) {}
}
