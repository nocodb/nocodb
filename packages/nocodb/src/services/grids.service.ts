import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ViewTypes } from 'nocodb-sdk';
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { GridView, Model, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class GridsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async gridViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      grid: ViewCreateReqType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.grid,
    );

    const model = await Model.get(context, param.tableId, ncMeta);
    // check for duplicated view title
    param.grid.title = param.grid.title?.trim();
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.grid.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.grid.title,
        label: 'title',
        base: context.base_id,
        additionalTrace: {
          table: param.tableId,
        },
      });
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
          param.tableId,
        )
      ).forCreate();

    const { id } = await View.insertMetaOnly(
      context,
      {
        view: {
          ...param.grid,
          // todo: sanitize
          fk_model_id: param.tableId,
          type: ViewTypes.GRID,
          base_id: model.base_id,
          source_id: model.source_id,
          created_by: param.req.user?.id,
          owned_by: param.ownedBy || param.req.user?.id,
        },
        model,
        req: param.req,
      },
      ncMeta,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id, ncMeta);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );
    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.GRID_CREATE, {
      view,
      req: param.req,
      owner,
      context,
    });

    await view.getView(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_create',
          payload: view,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return view;
  }

  async gridViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      grid: GridUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridUpdateReq',
      param.grid,
    );

    const view = await View.get(context, param.viewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const oldGridView = await GridView.get(context, param.viewId, ncMeta);
    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(param.viewId)
      ).forUpdate();

    await GridView.update(context, param.viewId, param.grid, ncMeta);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    this.appHooksService.emit(AppEvents.GRID_UPDATE, {
      view,
      gridView: param.grid,
      oldGridView,
      req: param.req,
      owner,
      context,
    });

    await view.getView(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: view,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return view;
  }
}
