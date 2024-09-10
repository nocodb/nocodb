import { Injectable } from '@nestjs/common';
import type User from '~/models/User';
import type { LayoutReqType, LayoutUpdateReqType } from 'nocodb-sdk';
import { T } from '~/utils';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import Layout from '~/models/Layout';

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
    // TODO: add the validation here again
    // was commenting it because for some reason it was complaining about
    // order being null or undefined (even though field was not declared as required in swagger)
    // Either fix swagger or deliver and send order always with the Layout data
    // validatePayload(
    //   'swagger.json#/components/schemas/LayoutUpdateReq',
    //   param.layout,
    // );

    const layout = await Layout.update(param.layoutId, param.layout);

    T.emit('evt', { evt_type: 'layout:updated' });

    return layout;
  }

  async layoutCreate(param: {
    dashboardId: string;
    sourceId?: string;
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
