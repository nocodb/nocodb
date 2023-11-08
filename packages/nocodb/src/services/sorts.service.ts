import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { SortReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Sort } from '~/models';

@Injectable()
export class SortsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async sortGet(param: { sortId: string }) {
    return Sort.get(param.sortId);
  }

  async sortDelete(param: { sortId: string; req: NcRequest }) {
    const sort = await Sort.get(param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    await Sort.delete(param.sortId);

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      req: param.req,
    });
    return true;
  }

  async sortUpdate(param: { sortId: any; sort: SortReqType; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.get(param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const res = await Sort.update(param.sortId, param.sort);

    this.appHooksService.emit(AppEvents.SORT_UPDATE, {
      sort,

      req: param.req,
    });

    return res;
  }

  async sortCreate(param: { viewId: any; sort: SortReqType; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.insert({
      ...param.sort,
      fk_view_id: param.viewId,
    } as Sort);

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      req: param.req,
    });

    return sort;
  }

  async sortList(param: { viewId: string }) {
    return Sort.list({ viewId: param.viewId });
  }
}
