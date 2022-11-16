import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { SortListType, TableReqType, TableType } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../models/Project';
import Sort from '../../models/Sort';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

// @ts-ignore
export async function sortGet(req: Request, res: Response<TableType>) {}

// @ts-ignore
export async function sortList(
  req: Request<any, any, any>,
  res: Response<SortListType>
) {
  const sortList = await Sort.list({ viewId: req.params.viewId });
  res.json({
    sorts: new PagedResponseImpl(sortList),
  });
}

// @ts-ignore
export async function sortCreate(req: Request<any, any, TableReqType>, res) {
  const sort = await Sort.insert({
    ...req.body,
    fk_view_id: req.params.viewId,
  });
  Tele.emit('evt', { evt_type: 'sort:created' });
  res.json(sort);
}

export async function sortUpdate(req, res) {
  const sort = await Sort.update(req.params.sortId, req.body);
  Tele.emit('evt', { evt_type: 'sort:updated' });
  res.json(sort);
}

export async function sortDelete(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'sort:deleted' });
  const sort = await Sort.delete(req.params.sortId);
  res.json(sort);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/views/:viewId/sorts/',
  metaApiMetrics,
  ncMetaAclMw(sortList, 'sortList')
);
router.post(
  '/api/v1/db/meta/views/:viewId/sorts/',
  metaApiMetrics,
  ncMetaAclMw(sortCreate, 'sortCreate')
);
router.get(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortGet, 'sortGet')
);
router.patch(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortUpdate, 'sortUpdate')
);
router.delete(
  '/api/v1/db/meta/sorts/:sortId',
  metaApiMetrics,
  ncMetaAclMw(sortDelete, 'sortDelete')
);
export default router;
