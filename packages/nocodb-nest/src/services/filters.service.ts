import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { Filter } from '../models';
import { NcError } from '../helpers/catchError';
import { AppEvents, AppHooksService } from './app-hooks/app-hooks.service';
import type { FilterReqType, UserType } from 'nocodb-sdk';

@Injectable()
export class FiltersService {
  constructor(private appHooksService: AppHooksService) {}

  async hookFilterCreate(param: {
    filter: FilterReqType;
    hookId: any;
    user: UserType;
  }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.insert({
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    T.emit('evt', { evt_type: 'hookFilter:created' });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      user: param.user,
    });

    return filter;
  }

  async hookFilterList(param: { hookId: any }) {
    return Filter.rootFilterListByHook({ hookId: param.hookId });
  }

  async filterDelete(param: { filterId: string; user: UserType }) {
    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    await Filter.delete(param.filterId);
    T.emit('evt', { evt_type: 'filter:deleted' });

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      user: param.user,
    });

    return true;
  }

  async filterCreate(param: {
    filter: FilterReqType;
    viewId: string;
    user: UserType;
  }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.insert({
      ...param.filter,
      fk_view_id: param.viewId,
    });

    T.emit('evt', { evt_type: 'filter:created' });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      user: param.user,
    });

    return filter;
  }
  async filterUpdate(param: {
    filter: FilterReqType;
    filterId: string;
    user: UserType;
  }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    // todo: type correction
    const res = await Filter.update(param.filterId, param.filter as Filter);

    T.emit('evt', { evt_type: 'filter:updated' });

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter,
      user: param.user,
    });

    return res;
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
