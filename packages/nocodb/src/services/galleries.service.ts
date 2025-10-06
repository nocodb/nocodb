import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ViewTypes } from 'nocodb-sdk';
import type {
  GalleryUpdateReqType,
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
import { GalleryView, Model, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class GalleriesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async galleryViewGet(context: NcContext, param: { galleryViewId: string }) {
    return await GalleryView.get(context, param.galleryViewId);
  }

  async galleryViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      gallery: ViewCreateReqType;
      user: UserType;
      ownedBy?: string;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gallery,
    );

    const model = await Model.get(context, param.tableId, ncMeta);
    param.gallery.title = param.gallery.title?.trim();
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.gallery.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.gallery.title,
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
          ...param.gallery,
          // todo: sanitize
          fk_model_id: param.tableId,
          type: ViewTypes.GALLERY,
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

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id, ncMeta);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy, ncMeta);
    }

    this.appHooksService.emit(AppEvents.GALLERY_CREATE, {
      view: {
        ...param.gallery,
        ...view,
      },
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

  async galleryViewUpdate(
    context: NcContext,
    param: {
      galleryViewId: string;
      gallery: GalleryUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GalleryUpdateReq',
      param.gallery,
    );

    const view = await View.get(context, param.galleryViewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.galleryViewId);
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

    const oldGalleryView = await GalleryView.get(
      context,
      param.galleryViewId,
      ncMeta,
    );

    await GalleryView.update(
      context,
      param.galleryViewId,
      param.gallery,
      ncMeta,
    );

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    this.appHooksService.emit(AppEvents.GALLERY_UPDATE, {
      view,
      galleryView: param.gallery,
      oldGalleryView,
      oldView: view,
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
