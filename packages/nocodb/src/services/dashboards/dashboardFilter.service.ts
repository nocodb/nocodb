import { T } from 'nc-help';
import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import Filter from '../../models/Filter';
import type {
  FilterReqType,
  WidgetReqType,
  WidgetUpdateReqType,
} from 'nocodb-sdk';

Injectable();
export class DashboardFilterService {
  async getFilters(param: { widgetId: string }) {
    return Filter.rootFilterListByWidget({ widgetId: param.widgetId });
  }

  async filterCreate(param: {
    layoutId: string;
    widgetId: string;
    dashboardFilterReq: FilterReqType;
    req?: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/FilterReq',
      param.dashboardFilterReq,
    );

    const widget = await Filter.insert({
      ...param.dashboardFilterReq,
      fk_widget_id: param.widgetId,
    } as any);

    T.emit('evt', { evt_type: 'dashboard_filter:created' });

    return widget;
  }
}
