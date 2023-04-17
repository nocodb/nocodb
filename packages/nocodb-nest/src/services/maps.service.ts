import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { MapView, View } from '../models';
import type { MapUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';

@Injectable()
export class MapsService {
  async mapViewGet(param: { mapViewId: string }) {
    return await MapView.get(param.mapViewId);
  }

  async mapViewCreate(param: { tableId: string; map: ViewCreateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.map,
    );
    const view = await View.insert({
      ...param.map,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.MAP,
    });
    T.emit('evt', { evt_type: 'vtable:created', show_as: 'map' });
    return view;
  }

  async mapViewUpdate(param: { mapViewId: string; map: MapUpdateReqType }) {
    validatePayload('swagger.json#/components/schemas/MapUpdateReq', param.map);
    T.emit('evt', { evt_type: 'view:updated', type: 'map' });
    return await MapView.update(param.mapViewId, param.map);
  }
}
