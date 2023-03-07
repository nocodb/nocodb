import type { GalleryReqType } from 'nocodb-sdk';
import { ViewTypes } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../../meta/api/helpers';
import { GalleryView, View } from '../../models';

export async function galleryViewGet(param: { galleryViewId: string }) {
  return await GalleryView.get(param.galleryViewId);
}

export async function galleryViewCreate(param: {
  tableId: string;
  gallery: GalleryReqType;
}) {
  validatePayload('swagger.json#/components/schemas/GalleryReq', param.gallery);

  T.emit('evt', { evt_type: 'vtable:created', show_as: 'gallery' });
  const view = await View.insert({
    ...param.gallery,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.GALLERY,
  });
  return view;
}

export async function galleryViewUpdate(param: {
  galleryViewId: string;
  gallery: GalleryReqType;
}) {
  validatePayload('swagger.json#/components/schemas/GalleryReq', param.gallery);

  T.emit('evt', { evt_type: 'view:updated', type: 'gallery' });
  await GalleryView.update(param.galleryViewId, param.gallery);
}
