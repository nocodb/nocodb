import { ViewTypes } from 'nocodb-sdk';
import { T } from 'nc-help';
import View from '../../models/View';
import MapView from '../../models/MapView';
import { validatePayload } from '../../meta/api/helpers';
import type { MapType, ViewCreateReqType } from 'nocodb-sdk';

export async function mapViewGet(param: { mapViewId: string }) {
  return await MapView.get(param.mapViewId);
}

export async function mapViewCreate(param: {
  tableId: string;
  map: ViewCreateReqType;
}) {
  validatePayload('swagger.json#/components/schemas/ViewCreateReq', param.map);
  const view = await View.insert({
    ...param.map,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.MAP,
  });
  T.emit('evt', { evt_type: 'vtable:created', show_as: 'map' });
  return view;
}

export async function mapViewUpdate(param: {
  mapViewId: string;
  // todo: add MapReq in schema
  map: MapType;
}) {
  T.emit('evt', { evt_type: 'view:updated', type: 'map' });
  // todo: type correction
  return await MapView.update(param.mapViewId, param.map as any);
}
