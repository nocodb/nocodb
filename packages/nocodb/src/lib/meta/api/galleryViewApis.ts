import { Request, Response, Router } from 'express';
import { GalleryType, ViewTypes } from 'nocodb-sdk';
import View from '../../models/View';
import GalleryView from '../../models/GalleryView';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';
export async function galleryViewGet(req: Request, res: Response<GalleryType>) {
  res.json(await GalleryView.get(req.params.galleryViewId));
}

export async function galleryViewCreate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'gallery' });
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.GALLERY,
  });
  res.json(view);
}

export async function galleryViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'gallery' });
  res.json(await GalleryView.update(req.params.galleryViewId, req.body));
}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/galleries',
  metaApiMetrics,
  ncMetaAclMw(galleryViewCreate, 'galleryViewCreate')
);
router.patch(
  '/api/v1/db/meta/galleries/:galleryViewId',
  metaApiMetrics,
  ncMetaAclMw(galleryViewUpdate, 'galleryViewUpdate')
);
router.get(
  '/api/v1/db/meta/galleries/:galleryViewId',
  metaApiMetrics,
  ncMetaAclMw(galleryViewGet, 'galleryViewGet')
);
export default router;
