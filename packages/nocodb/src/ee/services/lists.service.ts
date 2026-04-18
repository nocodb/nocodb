import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import type {
  ListUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { ListView, Model, Source, User, View } from '~/models';
import ListViewLevel from '~/models/ListViewLevel';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import NocoSocket from '~/socket/NocoSocket';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';

@Injectable()
export class ListsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async listViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      list: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_LIST_VIEW);

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.list,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, (param.list as any).lock_type);

    const model = await Model.get(context, param.tableId);

    const source = await Source.get(context, model.source_id);
    if (source.type !== 'pg') {
      NcError.get(context).badRequest(
        'List view is only supported for Postgres or Default source',
      );
    }

    param.list.title = param.list.title?.trim();
    const existingView = await View.getByTitleOrId(context, {
      titleOrId: param.list.title,
      fk_model_id: param.tableId,
    });
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.list.title,
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

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.list,
        fk_model_id: param.tableId,
        type: ViewTypes.LIST,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    const view = await View.get(context, id);
    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.LIST_CREATE, {
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

  async listViewUpdate(
    context: NcContext,
    param: {
      listViewId: string;
      list: ListUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ListUpdateReq',
      param.list,
    );

    const view = await View.get(context, param.listViewId);

    if (!view) {
      NcError.get(context).viewNotFound(param.listViewId);
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const oldListView = await ListView.get(context, param.listViewId);

    if (param.list.levels) {
      await ListViewLevel.bulkInsertOrUpdate(
        context,
        param.listViewId,
        param.list.levels,
      );
    }

    const { levels: _levels, ...updateData } = param.list;
    await ListView.update(context, param.listViewId, updateData);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.LIST_UPDATE, {
      view,
      listView: param.list,
      oldListView,
      req: param.req,
      context,
      owner,
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
