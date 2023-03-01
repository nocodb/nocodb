import { Tele } from 'nc-help';
import { FilterReqType } from 'nocodb-sdk';
import Filter from '../models/Filter';

export async function filterGet(param: { hookId: string }) {
  const filter = await Filter.getFilterObject({ hookId: param.hookId });

  return filter;
}

export async function filterList(param: { hookId: string }) {
  const filters = await Filter.rootFilterListByHook({
    hookId: param.hookId,
  });

  return filters;
}

export async function filterChildrenRead(param: {
  hookId: string;
  filterParentId: string;
}) {
  const filter = await Filter.parentFilterListByHook({
    hookId: param.hookId,
    parentId: param.filterParentId,
  });

  return filter;
}

export async function filterCreate(param: {
  hookId: string;
  filter: FilterReqType;
}) {
  const filter = await Filter.insert({
    ...param.filter,
    fk_hook_id: param.hookId,
  });

  Tele.emit('evt', { evt_type: 'hookFilter:created' });
  return filter;
}

export async function filterUpdate(param: {
  hookId: string;
  filterId: string;
  filter: FilterReqType;
}) {
  const filter = await Filter.update(param.filterId, {
    ...param.filter,
    fk_hook_id: param.hookId,
  } as Filter);
  Tele.emit('evt', { evt_type: 'hookFilter:updated' });
  return filter;
}

export async function filterDelete(param: { filterId: string }) {
  await Filter.delete(param.filterId);
  Tele.emit('evt', { evt_type: 'hookFilter:deleted' });
  return true;
}
