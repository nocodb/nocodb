import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ViewTypes } from 'nocodb-sdk';
import type {
  OutlineUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { OutlineView, Model, Source, User, View } from '~/models';
import OutlineViewLevel from '~/models/OutlineViewLevel';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import NocoSocket from '~/socket/NocoSocket';
import { type ViewWebhookManager, ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager'
import type { MetaService } from '~/meta/meta.service'

@Injectable()
export class OutlinesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async outlineViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      outline: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.outline,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const model = await Model.get(context, param.tableId);

    const source = await Source.get(context, model.source_id);
    if (source.type !== 'pg') {
      NcError.get(context).badRequest(
        'Outline view is only supported for Postgres or Default source',
      );
    }

    param.outline.title = param.outline.title?.trim();
    const existingView = await View.getByTitleOrId(context, {
      titleOrId: param.outline.title,
      fk_model_id: param.tableId,
    });
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.outline.title,
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
        ...param.outline,
        fk_model_id: param.tableId,
        type: ViewTypes.OUTLINE,
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

    this.appHooksService.emit(AppEvents.OUTLINE_CREATE, {
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

  async outlineViewUpdate(
    context: NcContext,
    param: {
      outlineViewId: string;
      outline: OutlineUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/OutlineUpdateReq',
      param.outline,
    );

    const view = await View.get(context, param.outlineViewId);

    if (!view) {
      NcError.get(context).viewNotFound(param.outlineViewId);
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

    const oldOutlineView = await OutlineView.get(context, param.outlineViewId);

    if (param.outline.levels) {
      await OutlineViewLevel.bulkInsertOrUpdate(
        context,
        param.outlineViewId,
        param.outline.levels,
      );
    }

    const { levels: _levels, ...updateData } = param.outline;
    await OutlineView.update(context, param.outlineViewId, updateData);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.OUTLINE_UPDATE, {
      view,
      outlineView: param.outline,
      oldOutlineView,
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
