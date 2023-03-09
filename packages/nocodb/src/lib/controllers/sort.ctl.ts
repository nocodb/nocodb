import { Router } from 'express';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { sortService } from '../services';
import type { SortListType, SortReqType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

// @ts-ignore
export async function sortList(
  req: Request<any, any, any>,
  res: Response<SortListType>
) {
  const sortList = await sortService.sortList({
    viewId: req.params.viewId,
  });
  res.json({
    sorts: new PagedResponseImpl(sortList),
  });
}

// @ts-ignore
export async function sortCreate(req: Request<any, any, SortReqType>, res) {
  const sort = await sortService.sortCreate({
    sort: req.body,
    viewId: req.params.viewId,
  });
  res.json(sort);
}

export async function sortUpdate(req, res) {
  const sort = await sortService.sortUpdate({
    sortId: req.params.sortId,
    sort: req.body,
  });
  res.json(sort);
}

export async function sortDelete(req: Request, res: Response) {
  const sort = await sortService.sortDelete({
    sortId: req.params.sortId,
  });
  res.json(sort);
}
export async function sortGet(req: Request, res: Response) {
  const sort = await sortService.sortGet({
    sortId: req.params.sortId,
  });
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
