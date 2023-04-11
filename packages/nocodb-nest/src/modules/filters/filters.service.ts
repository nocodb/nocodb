import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { validatePayload } from '../../helpers';
import { Filter } from '../../models';
import type { FilterReqType } from 'nocodb-sdk';

@Injectable()
export class FiltersService {
  async hookFilterCreate(param: { filter: FilterReqType; hookId: any }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.insert({
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    T.emit('evt', { evt_type: 'hookFilter:created' });
    return filter;
  }

  async hookFilterList(param: { hookId: any }) {
    return Filter.rootFilterListByHook({ hookId: param.hookId });
  }

  async filterDelete(param: { filterId: string }) {
    await Filter.delete(param.filterId);
    T.emit('evt', { evt_type: 'filter:deleted' });
    return true;
  }

  async filterCreate(param: { filter: FilterReqType; viewId: string }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.insert({
      ...param.filter,
      fk_view_id: param.viewId,
    });

    T.emit('evt', { evt_type: 'filter:created' });

    return filter;
  }
  async filterUpdate(param: { filter: FilterReqType; filterId: string }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    // todo: type correction
    const filter = await Filter.update(param.filterId, param.filter as Filter);

    T.emit('evt', { evt_type: 'filter:updated' });

    return filter;
  }

  async filterChildrenList(param: { filterId: any }) {
    return Filter.parentFilterList({
      parentId: param.filterId,
    });
  }

  async filterGet(param: { filterId: string }) {
    const filter = await Filter.get(param.filterId);
    return filter;
  }

  async filterList(param: { viewId: string }) {
    const filter = await Filter.rootFilterList({ viewId: param.viewId });
    return filter;
  }
}
