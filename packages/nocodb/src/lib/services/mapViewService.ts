import { MapType, ViewTypes } from 'nocodb-sdk';
import View from '../models/View';
import { Tele } from 'nc-help';
import MapView from '../models/MapView';

export async function mapViewGet(param:{mapViewId: string}) {
  return await MapView.get(param.mapViewId)
}

export async function mapViewCreate(param:{
  tableId: string,
  // todo: add MapReq in schema
  map: MapType
}) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'map' });
  const view = await View.insert({
    ...param.map,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.MAP,
  });
  return view;
}

export async function mapViewUpdate(param:{
  mapViewId: string,
  // todo: add MapReq in schema
  map: MapType

}) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'map' });
  // todo: type correction
  return await MapView.update(param.mapViewId, param.map as any)
}
