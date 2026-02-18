import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ViewTypes } from 'nocodb-sdk';
import type {
  TimelineUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model, User, View } from '~/models';
import TimelineView from '~/models/TimelineView';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class TimelinesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async timelineViewGet(
    context: NcContext,
    param: { timelineViewId: string },
  ) {
    return await TimelineView.get(context, param.timelineViewId);
  }

  async timelineViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      timeline: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.timeline,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const model = await Model.get(context, param.tableId, ncMeta);

    param.timeline.title = param.timeline.title?.trim();
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.timeline.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.timeline.title,
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
          ...param.timeline,
          fk_model_id: param.tableId,
          type: ViewTypes.TIMELINE,
          base_id: model.base_id,
          source_id: model.source_id,
          created_by: param.user?.id,
          owned_by: param.ownedBy || param.user?.id,
        },
        model,
        req: param.req,
      },
      ncMeta,
    );

    const view = await View.get(context, id, ncMeta);

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

    this.appHooksService.emit(AppEvents.TIMELINE_CREATE, {
      view: {
        ...view,
        ...param.timeline,
      },
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

  async timelineViewUpdate(
    context: NcContext,
    param: {
      timelineViewId: string;
      timeline: TimelineUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/TimelineUpdateReq',
      param.timeline,
      true,
    );

    const view = await View.get(context, param.timelineViewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.timelineViewId);
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

    const oldTimelineView = await TimelineView.get(
      context,
      param.timelineViewId,
      ncMeta,
    );

    await TimelineView.update(
      context,
      param.timelineViewId,
      param.timeline,
      ncMeta,
    );

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    this.appHooksService.emit(AppEvents.TIMELINE_UPDATE, {
      view: {
        ...view,
        ...param.timeline,
      },
      timelineView: param.timeline,
      oldTimelineView,
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
