import { T } from 'nc-help';
import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import Widget from '../../models/Widget';
import type { WidgetReqType, WidgetUpdateReqType } from 'nocodb-sdk';

Injectable();
export class WidgetsService {
  async widgetUpdate(param: {
    widgetId: string;
    widgetUpdateReq: WidgetUpdateReqType;
    req?: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/WidgetUpdateReq',
      param.widgetUpdateReq,
    );

    const widget = await Widget.update(param.widgetId, param.widgetUpdateReq);

    T.emit('evt', { evt_type: 'layout:updated' });

    return widget;
  }

  async widgetDelete({ widgetId: WidgetId }: { widgetId: string }) {
    Widget.delete(WidgetId);
    T.emit('evt', {
      evt_type: 'layout_widget:deleted',
    });
    return true;
  }

  async getWidgets(param: { layoutId: string }) {
    return Widget.list({ layout_id: param.layoutId });
  }

  async widgetCreate(param: {
    layoutId: string;
    widgetReq: WidgetReqType;
    req?: any;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/WidgetReq',
      param.widgetReq,
    );

    // validateLayoutPayload(param.layout);

    const widget = await Widget.insert({
      ...param.widgetReq,
    } as any);

    T.emit('evt', { evt_type: 'widget:created' });

    return widget;
  }

  // export async function WidgetList(param: { projectId: string }) {
  //   return await Widget.list({ project_id: param.projectId });
  // }
}
