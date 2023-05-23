import { T } from 'nc-help';
import { Injectable } from '@nestjs/common';
import { Model } from 'src/models';
import Widget from 'src/models/Widget';
import { validatePayload } from '../../helpers';
import Layout from '../../models/Layout';
import Noco from '../../Noco';
import type User from 'src/models/User';
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

    const layout = await Layout.insert({
      ...param.layout,
    } as any);

    T.emit('evt', { evt_type: 'layout:created' });

    return layout;
  }

  async getLayouts(param: { dashboardId: string }) {
    return await Layout.list({ dashboard_id: param.dashboardId });
  }

  async layoutDelete(
    param: { layoutId: string; user: User; req?: any },
    ncMeta = Noco.ncMeta,
  ) {
    const layout = await Layout.delete(param.layoutId, ncMeta);

    // TODO: remove 'nc_ds_widget_db_dependencies_v2' entries here (or in the model) as well
    return layout;
  }
}
