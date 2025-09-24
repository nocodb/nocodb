import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import RowColorCondition from 'src/models/RowColorCondition';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import type { MetaService } from 'src/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';

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
    ncMeta?: MetaService,
  ) {
    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    const parentData = await filter.extractRelatedParentMetas(context);

    let viewWebhookManager: ViewWebhookManager;
    if (filter.fk_view_id) {
      const view = await View.get(context, filter.fk_view_id, ncMeta);
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(filter.fk_view_id)
      ).forUpdate();
    } else if (filter.fk_row_color_condition_id) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        filter.fk_row_color_condition_id,
        ncMeta,
      );
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        ncMeta,
      );
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }
    await Filter.delete(context, param.filterId);

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      req: param.req,
      context,
      ...parentData,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_delete',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
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

    const viewWebhookManager: ViewWebhookManager = (
      await (
        await new ViewWebhookManagerBuilder(context).withModelId(
          view.fk_model_id,
        )
      ).withViewId(param.viewId)
    ).forUpdate();

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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_create',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
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
    ncMeta?: MetaService,
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(context, param.filterId, ncMeta);

    let viewWebhookManager: ViewWebhookManager;
    if (filter.fk_view_id) {
      const view = await View.get(context, filter.fk_view_id, ncMeta);
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(filter.fk_view_id)
      ).forUpdate();
    } else if (filter.fk_row_color_condition_id) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        filter.fk_row_color_condition_id,
        ncMeta,
      );
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        ncMeta,
      );
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }

    if (!filter) {
      NcError.badRequest('Filter not found');
    }
    // todo: type correction
    const res = await Filter.update(
      context,
      param.filterId,
      param.filter as Filter,
      ncMeta,
    );

    const parentData = await filter.extractRelatedParentMetas(context, ncMeta);

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter: { ...filter, ...param.filter },
      oldFilter: filter,
      req: param.req,
      ...parentData,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_update',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
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
