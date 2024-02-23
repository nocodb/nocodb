import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  GalleryUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { GalleryView, Model, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class GalleriesService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async galleryViewGet(param: { galleryViewId: string }) {
    return await GalleryView.get(param.galleryViewId);
  }

  async galleryViewCreate(param: {
    tableId: string;
    gallery: ViewCreateReqType;
    user: UserType;

    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gallery,
    );

    const model = await Model.get(param.tableId);

    const { id } = await View.insertMetaOnly(
      {
        ...param.gallery,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.GALLERY,
        base_id: model.base_id,
        source_id: model.source_id,
      },
      model,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'gallery',
      req: param.req,
    });
    return view;
  }

  async galleryViewUpdate(param: {
    galleryViewId: string;
    gallery: GalleryUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/GalleryUpdateReq',
      param.gallery,
    );

    const view = await View.get(param.galleryViewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await GalleryView.update(param.galleryViewId, param.gallery);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'gallery',
      req: param.req,
    });

    return res;
  }
}
