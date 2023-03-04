import { SortReqType } from 'nocodb-sdk';
import { validatePayload } from '../meta/api/helpers';
import Sort from '../models/Sort';
import { T } from 'nc-help';

export async function sortGet(param: { sortId: string }) {
  return Sort.get(param.sortId);
}

export async function sortDelete(param: { sortId: string }) {
  await Sort.delete(param.sortId);
  T.emit('evt', { evt_type: 'sort:deleted' });
  return true;
}

export async function sortUpdate(param: { sortId: any; sort: SortReqType }) {
  validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

  const sort = await Sort.update(param.sortId, param.sort);
  T.emit('evt', { evt_type: 'sort:updated' });
  return sort;
}

export async function sortCreate(param: { viewId: any; sort: SortReqType }) {
  validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

  const sort = await Sort.insert({
    ...param.sort,
    fk_view_id: param.viewId,
  } as Sort);
  T.emit('evt', { evt_type: 'sort:created' });
  return sort;
}

export async function sortList(param: { viewId: string }) {
  return Sort.list({ viewId: param.viewId });
}
