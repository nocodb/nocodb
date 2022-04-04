import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../../noco-models/Model';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { GalleryType, TableListType, ViewTypes } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../../sqlMgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../../noco-models/Project';
import View from '../../../noco-models/View';
import GalleryView from '../../../noco-models/GalleryView';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';
// @ts-ignore
export async function galleryViewGet(req: Request, res: Response<GalleryType>) {
  res.json(await GalleryView.get(req.params.galleryViewId));
}

// @ts-ignore
export async function galleyViewList(
  _req: Request<any, any, any>,
  _res: Response<TableListType>
) {}

// @ts-ignore
export async function galleryViewCreate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'gallery' });
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.GALLERY
  });
  res.json(view);
}

// @ts-ignore
export async function galleryViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'gallery' });
  res.json(await GalleryView.update(req.params.galleryViewId, req.body));
}

// @ts-ignore
export async function galleyViewDelete(req: Request, res: Response, next) {}

const router = Router({ mergeParams: true });
// router.get('/', galleyViewList);
router.post('/tables/:tableId/galleries', ncMetaAclMw(galleryViewCreate));
// router.get('/:galleryViewId', galleyViewGet);
router.put('/galleries/:galleryViewId', ncMetaAclMw(galleryViewUpdate));
router.get('/galleries/:galleryViewId', ncMetaAclMw(galleryViewGet));
// router.delete('/:galleryViewId', galleyViewDelete);
export default router;
