import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { Filter, Hook, View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { FilterReqType } from 'nocodb-sdk';

@Injectable()
export class FiltersService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async hookFilterCreate(param: { filter: FilterReqType; hookId: any }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const hook = await Hook.get(param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    const filter = await Filter.insert({
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      hook,
    });
    return filter;
  }

  async hookFilterList(param: { hookId: any }) {
    return Filter.rootFilterListByHook({ hookId: param.hookId });
  }

  async filterDelete(param: { filterId: string }) {
    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    await Filter.delete(param.filterId);

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
    });

    return true;
  }

  async filterCreate(param: { filter: FilterReqType; viewId: string }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(param.viewId);

    const filter = await Filter.insert({
      ...param.filter,
      fk_view_id: param.viewId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
    });

    return filter;
  }
  async filterUpdate(param: { filter: FilterReqType; filterId: string }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    // todo: type correction
    const res = await Filter.update(param.filterId, param.filter as Filter);

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter,
    });

    return res;
  }

  async filterChildrenList(param: { filterId: string }) {
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
