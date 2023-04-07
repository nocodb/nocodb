import { Injectable } from '@nestjs/common';
import { SortReqType } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { Sort } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class SortsService {
  async sortGet(param: { sortId: string }) {
    return Sort.get(param.sortId);
  }

  async sortDelete(param: { sortId: string }) {
    await Sort.delete(param.sortId);
    T.emit('evt', { evt_type: 'sort:deleted' });
    return true;
  }

  async sortUpdate(param: { sortId: any; sort: SortReqType }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.update(param.sortId, param.sort);
    T.emit('evt', { evt_type: 'sort:updated' });
    return sort;
  }

  async sortCreate(param: { viewId: any; sort: SortReqType }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.insert({
      ...param.sort,
      fk_view_id: param.viewId,
    } as Sort);
    T.emit('evt', { evt_type: 'sort:created' });
    return sort;
  }

  async sortList(param: { viewId: string }) {
    return Sort.list({ viewId: param.viewId });
  }
}
