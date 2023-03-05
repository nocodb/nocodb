import { FilterReqType } from 'nocodb-sdk';
import { validatePayload } from '../meta/api/helpers';
import Filter from '../models/Filter';
import { T } from 'nc-help';

export async function hookFilterCreate(param: {
  filter: FilterReqType;
  hookId: any;
}) {
  validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

  const filter = await Filter.insert({
    ...param.filter,
    fk_hook_id: param.hookId,
  });

  T.emit('evt', { evt_type: 'hookFilter:created' });
  return filter;
}

export async function hookFilterList(param: { hookId: any }) {
  return Filter.rootFilterListByHook({ hookId: param.hookId });
}

export async function filterDelete(param: { filterId: string }) {
  await Filter.delete(param.filterId);
  T.emit('evt', { evt_type: 'filter:deleted' });
  return true;
}

export async function filterCreate(param: {
  filter: FilterReqType;
  viewId: string;
}) {
  validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

  const filter = await Filter.insert({
    ...param.filter,
    fk_view_id: param.viewId,
  });

  T.emit('evt', { evt_type: 'filter:created' });

  return filter;
}
export async function filterUpdate(param: {
  filter: FilterReqType;
  filterId: string;
}) {
  validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

  // todo: type correction
  const filter = await Filter.update(param.filterId, param.filter as Filter);

  T.emit('evt', { evt_type: 'filter:updated' });

  return filter;
}

export async function filterChildrenList(param: { filterId: any }) {
  return Filter.parentFilterList({
    parentId: param.filterId,
  });
}

export async function filterGet(param: { filterId: string }) {
  const filter = await Filter.get(param.filterId);
  return filter;
}

export async function filterList(param: { viewId: string }) {
  const filter = await Filter.rootFilterList({ viewId: param.viewId });
  return filter;
}
