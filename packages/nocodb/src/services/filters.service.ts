import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';

@Injectable()
export class FiltersService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async hookFilterCreate(param: {
    filter: FilterReqType;
    hookId: any;
    user: UserType;
    req: NcRequest;
  }) {
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
      req: param.req,
    });
    return filter;
  }

  async hookFilterList(param: { hookId: any }) {
    return Filter.rootFilterListByHook({ hookId: param.hookId });
  }

  async filterDelete(param: { filterId: string; req: NcRequest }) {
    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    await Filter.delete(param.filterId);

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      req: param.req,
    });

    return true;
  }

  async filterCreate(param: {
    filter: FilterReqType;
    viewId: string;
    user: UserType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(param.viewId);

    const filter = await Filter.insert({
      ...param.filter,
      fk_view_id: param.viewId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
      req: param.req,
    });

    return filter;
  }

  async filterUpdate(param: {
    filter: FilterReqType;
    filterId: string;
    user: UserType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }
    // todo: type correction
    const res = await Filter.update(param.filterId, param.filter as Filter);

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter,
      req: param.req,
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
