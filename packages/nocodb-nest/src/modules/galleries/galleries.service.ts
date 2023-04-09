import { Injectable } from '@nestjs/common';
import { GalleryUpdateReqType, ViewCreateReqType, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { GalleryView, View } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class GalleriesService {
  async galleryViewGet(param: { galleryViewId: string }) {
    return await GalleryView.get(param.galleryViewId);
  }

  async galleryViewCreate(param: {
    tableId: string;
    gallery: ViewCreateReqType;
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
