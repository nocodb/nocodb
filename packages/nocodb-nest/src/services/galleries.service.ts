import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { GalleryView, View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type {
  GalleryUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';

@Injectable()
export class GalleriesService {
  constructor(private appHooksService: AppHooksService) {}

  async galleryViewGet(param: { galleryViewId: string }) {
    return await GalleryView.get(param.galleryViewId);
  }

  async galleryViewCreate(param: {
    tableId: string;
    gallery: ViewCreateReqType;
    user: UserType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gallery,
    );

    T.emit('evt', { evt_type: 'vtable:created', show_as: 'gallery' });
    const view = await View.insert({
      ...param.gallery,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.GALLERY,
    });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      user: param.user,
      view,
    });

    return view;
  }

  async galleryViewUpdate(param: {
    galleryViewId: string;
    gallery: GalleryUpdateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/GalleryUpdateReq',
      param.gallery,
    );

    T.emit('evt', { evt_type: 'view:updated', type: 'gallery' });
    return await GalleryView.update(param.galleryViewId, param.gallery);
  }
}
