import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Column, Sort, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';

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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_delete',
          payload: sort,
        },
      },
      context.socket_id,
    );

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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_update',
          payload: {
            ...sort,
            ...param.sort,
          },
        },
      },
      context.socket_id,
    );

    return res;
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: string; sort: SortReqType; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const sort = await Sort.insert(
      context,
      {
        ...param.sort,
        fk_view_id: param.viewId,
      } as Sort,
      ncMeta,
    );

    const view = await View.get(context, param.viewId, ncMeta);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const column = await Column.get(
      context,
      { colId: sort.fk_column_id },
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      view,
      column,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_create',
          payload: sort,
        },
      },
      context.socket_id,
    );

    return sort;
  }

  async sortList(context: NcContext, param: { viewId: string }) {
    return Sort.list(context, { viewId: param.viewId });
  }
}
