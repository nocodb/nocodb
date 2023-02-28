import { Request, Response, Router } from 'express';
import { GalleryType } from 'nocodb-sdk';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { galleryViewService } from '../services';

export async function galleryViewGet(req: Request, res: Response<GalleryType>) {
  res.json(
    await galleryViewService.galleryViewGet({
      galleryViewId: req.params.galleryViewId,
    })
  );
}

export async function galleryViewCreate(req: Request<any, any>, res) {
  const view = await galleryViewService.galleryViewCreate({
    gallery: req.body,
    // todo: sanitize
    tableId: req.params.tableId,
  });
  res.json(view);
}

export async function galleryViewUpdate(req, res) {
  res.json(
    await galleryViewService.galleryViewUpdate({
      galleryViewId: req.params.galleryViewId,
      gallery: req.body,
    })
  );
}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/galleries',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/GalleryReq'),
  ncMetaAclMw(galleryViewCreate, 'galleryViewCreate')
);
router.patch(
  '/api/v1/db/meta/galleries/:galleryViewId',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/GalleryReq'),
  ncMetaAclMw(galleryViewUpdate, 'galleryViewUpdate')
);
router.get(
  '/api/v1/db/meta/galleries/:galleryViewId',
  metaApiMetrics,
  ncMetaAclMw(galleryViewGet, 'galleryViewGet')
);
export default router;
