import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk'
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError'
import { GalleryView, View } from '../models';
import type { GalleryUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { AppHooksService } from './app-hooks/app-hooks.service'

@Injectable()
export class GalleriesService {

  constructor(private readonly appHooksService: AppHooksService ) {}

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

    // T.emit('evt', { evt_type: 'vtable:created', show_as: 'gallery' });
    const view = await View.insert({
      ...param.gallery,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.GALLERY,
    });

    this.appHooksService.emit(AppEvents.VIEW_CREATE,{
      view,
      showAs: 'gallery',
    })
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

    const view = await View.get(param.galleryViewId);

    if(!view) {
      NcError.badRequest('View not found')
    }

    // T.emit('evt', { evt_type: 'view:updated', type: 'gallery' });
    const res = await GalleryView.update(param.galleryViewId, param.gallery);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE,{
      view,
      showAs: 'gallery',
    })

    return res;
  }
}
