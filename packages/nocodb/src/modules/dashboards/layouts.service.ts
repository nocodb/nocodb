import { T } from 'nc-help';
import { Injectable } from '@nestjs/common';
import { validatePayload } from '../../helpers';
import Layout from '../../models/Layout';
import type { LayoutReqType, LayoutUpdateReqType } from 'nocodb-sdk';

@Injectable()
export class LayoutsService {
  async getLayout(param: { layoutId: string }) {
    return await Layout.get(param.layoutId);
  }

  async layoutUpdate(param: {
    layoutId: string;
    layout: LayoutUpdateReqType;
    req?: any;
  }) {
    console.log(param.layout);
    validatePayload(
      'swagger.json#/components/schemas/LayoutUpdateReq',
      param.layout,
    );

    const layout = await Layout.update(param.layoutId, param.layout);

    T.emit('evt', { evt_type: 'layout:updated' });

    return layout;
  }

  async layoutCreate(param: {
    dashboardId: string;
    baseId?: string;
    layout: LayoutReqType;
    req?: any;
  }) {
    validatePayload('swagger.json#/components/schemas/LayoutReq', param.layout);

    // validateLayoutPayload(param.layout);

    const layout = await Layout.insert({
      ...param.layout,
    } as any);

    T.emit('evt', { evt_type: 'layout:created' });

    return layout;
  }

  async getLayouts(param: { dashboardId: string }) {
    return await Layout.list({ dashboard_id: param.dashboardId });
  }
}
