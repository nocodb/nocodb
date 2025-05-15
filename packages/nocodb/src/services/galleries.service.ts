import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  GalleryUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { GalleryView, Model, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

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
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gallery,
    );

    const model = await Model.get(context, param.tableId);

    const { id } = await View.insertMetaOnly(context, {
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
    });

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
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
    return view;
  }

  async galleryViewUpdate(
    context: NcContext,
    param: {
      galleryViewId: string;
      gallery: GalleryUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GalleryUpdateReq',
      param.gallery,
    );

    const view = await View.get(context, param.galleryViewId);

    if (!view) {
      NcError.viewNotFound(param.galleryViewId);
    }

    const oldGalleryView = await GalleryView.get(context, param.galleryViewId);

    const res = await GalleryView.update(
      context,
      param.galleryViewId,
      param.gallery,
    );

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
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

    return res;
  }
}
