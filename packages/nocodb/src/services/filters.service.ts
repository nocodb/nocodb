import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';

@Injectable()
export class FiltersService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async hookFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      hookId: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const hook = await Hook.get(context, param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      hook,
      req: param.req,
      context,
    });
    return filter;
  }

  async hookFilterList(context: NcContext, param: { hookId: any }) {
    return Filter.rootFilterListByHook(context, { hookId: param.hookId });
  }

  async filterDelete(
    context: NcContext,
    param: { filterId: string; req: NcRequest },
  ) {
    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    const parentData = await filter.extractRelatedParentMetas(context);

    await Filter.delete(context, param.filterId);

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      req: param.req,
      context,
      ...parentData,
    });

    return true;
  }

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(context, param.viewId);

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_view_id: param.viewId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
      req: param.req,
      context,
    });

    return filter;
  }

  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }
    // todo: type correction
    const res = await Filter.update(
      context,
      param.filterId,
      param.filter as Filter,
    );

    const parentData = await filter.extractRelatedParentMetas(context);

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter: { ...filter, ...param.filter },
      oldFilter: filter,
      req: param.req,
      ...parentData,
      context,
    });

    return res;
  }

  async filterChildrenList(context: NcContext, param: { filterId: string }) {
    return Filter.parentFilterList(context, {
      parentId: param.filterId,
    });
  }

  async filterGet(context: NcContext, param: { filterId: string }) {
    const filter = await Filter.get(context, param.filterId);
    return filter;
  }

  async filterList(
    context: NcContext,
    param: { viewId: string; includeAllFilters?: boolean },
  ) {
    const filter = await (param.includeAllFilters
      ? Filter.allViewFilterList(context, { viewId: param.viewId })
      : Filter.rootFilterList(context, { viewId: param.viewId }));

    return filter;
  }

  async linkFilterCreate(
    _context: NcContext,
    _param: {
      filter: any;
      columnId: string;
      user: UserType;
      req: NcRequest;
    },
  ): Promise<any> {
    // placeholder method
    return null;
  }
}
