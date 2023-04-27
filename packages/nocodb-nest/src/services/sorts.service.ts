import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { Sort } from '../models';
import { NcError } from '../helpers/catchError';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { SortReqType, UserType } from 'nocodb-sdk';
import {AppEvents} from "nocodb-sdk";

@Injectable()
export class SortsService {
  constructor(private appHooksService: AppHooksService) {}

  async sortGet(param: { sortId: string }) {
    return Sort.get(param.sortId);
  }

  async sortDelete(param: { sortId: string; user: UserType }) {
    const sort = await Sort.get(param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    await Sort.delete(param.sortId);
    T.emit('evt', { evt_type: 'sort:deleted' });

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      user: param.user,
    });

    return true;
  }

  async sortUpdate(param: { sortId: any; sort: SortReqType; user: UserType }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.get(param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const res = await Sort.update(param.sortId, param.sort);
    T.emit('evt', { evt_type: 'sort:updated' });

    this.appHooksService.emit(AppEvents.SORT_UPDATE, {
      sort,
      user: param.user,
    });

    return res;
  }

  async sortCreate(param: { viewId: any; sort: SortReqType; user: UserType }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.insert({
      ...param.sort,
      fk_view_id: param.viewId,
    } as Sort);
    T.emit('evt', { evt_type: 'sort:created' });

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      user: param.user,
    });

    return sort;
  }

  async sortList(param: { viewId: string }) {
    return Sort.list({ viewId: param.viewId });
  }
}
