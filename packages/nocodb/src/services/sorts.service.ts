import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Column, Sort, View } from '~/models';

@Injectable()
export class SortsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async sortGet(context: NcContext, param: { sortId: string }) {
    return Sort.get(context, param.sortId);
  }

  async sortDelete(
    context: NcContext,
    param: { sortId: string; req: NcRequest },
  ) {
    const sort = await Sort.get(context, param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const column = await Column.get(context, { colId: sort.fk_column_id });

    const view = await View.get(context, sort.fk_view_id);

    await Sort.delete(context, param.sortId);

    this.appHooksService.emit(AppEvents.SORT_DELETE, {
      sort,
      req: param.req,
      view,
      column,
      context,
    });
    return true;
  }

  async sortUpdate(
    context: NcContext,
    param: { sortId: any; sort: SortReqType; req: NcRequest },
  ) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.get(context, param.sortId);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const column = await Column.get(context, { colId: sort.fk_column_id });

    const view = await View.get(context, sort.fk_view_id);

    const res = await Sort.update(context, param.sortId, param.sort);

    this.appHooksService.emit(AppEvents.SORT_UPDATE, {
      sort: {
        ...sort,
        ...param.sort,
      },
      oldSort: sort,
      column,
      view,
      req: param.req,
      context,
    });

    return res;
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: string; sort: SortReqType; req: NcRequest },
  ) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.insert(context, {
      ...param.sort,
      fk_view_id: param.viewId,
    } as Sort);

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const column = await Column.get(context, { colId: sort.fk_column_id });

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      view,
      column,
      req: param.req,
      context,
    });

    return sort;
  }

  async sortList(context: NcContext, param: { viewId: string }) {
    return Sort.list(context, { viewId: param.viewId });
  }
}
