import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../../noco-models/Model';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { SortListType, TableReqType, TableType } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../../sqlMgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../../noco-models/Project';
import Sort from '../../../noco-models/Sort';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';

// @ts-ignore
export async function sortGet(req: Request, res: Response<TableType>) {}

// @ts-ignore
export async function sortList(
  req: Request<any, any, any>,
  res: Response<SortListType>
) {
  const sortList = await Sort.list({ viewId: req.params.viewId });
  res.json({
    sorts: new PagedResponseImpl(sortList)
  });
}

// @ts-ignore
export async function sortCreate(req: Request<any, any, TableReqType>, res) {
  const sort = await Sort.insert({
    ...req.body,
    fk_view_id: req.params.viewId
  });
  Tele.emit('evt', { evt_type: 'sort:created' });
  res.json(sort);
}

// @ts-ignore
export async function sortUpdate(req, res, next) {
  const sort = await Sort.update(req.params.sortId, req.body);
  Tele.emit('evt', { evt_type: 'sort:updated' });
  res.json(sort);
}

// @ts-ignore
export async function sortDelete(req: Request, res: Response, next) {
  Tele.emit('evt', { evt_type: 'sort:deleted' });
  const sort = await Sort.delete(req.params.sortId);
  res.json(sort);
}

const router = Router({ mergeParams: true });
router.get('/views/:viewId/sorts/', ncMetaAclMw(sortList));
router.post('/views/:viewId/sorts/', ncMetaAclMw(sortCreate));
router.get('/views/:viewId/sorts/:sortId', ncMetaAclMw(sortGet));
router.put('/views/:viewId/sorts/:sortId', ncMetaAclMw(sortUpdate));
router.delete('/views/:viewId/sorts/:sortId', ncMetaAclMw(sortDelete));
export default router;
