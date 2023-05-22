import { T } from 'nc-help';
import { Injectable } from '@nestjs/common';
import { Model } from 'src/models';
import Noco from 'src/Noco';
import { validatePayload } from '../../helpers';
import Layout from '../../models/Layout';
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
    const layout = await Layout.get(param.layoutId);

    const view = await this.get(viewId);
    await Sort.deleteAll(viewId);
    await Filter.deleteAll(viewId);
    const table = this.extractViewTableName(view);
    const tableScope = this.extractViewTableNameScope(view);
    const columnTable = this.extractViewColumnsTableName(view);
    const columnTableScope = this.extractViewColumnsTableNameScope(view);
    await ncMeta.metaDelete(null, null, columnTable, {
      fk_view_id: viewId,
    });

    return layout.delete();
  }
}
