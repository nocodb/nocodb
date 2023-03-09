import { Router } from 'express';
import { T } from 'nc-help';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { hookFilterService } from '../services';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import type { Request, Response } from 'express';

export async function filterGet(req: Request, res: Response) {
  const filter = await hookFilterService.filterGet({
    hookId: req.params.hookId,
  });

  res.json(filter);
}

export async function filterList(req: Request, res: Response) {
  res.json(
    new PagedResponseImpl(
      await hookFilterService.filterList({
        hookId: req.params.hookId,
      })
    )
  );
}

export async function filterChildrenRead(req: Request, res: Response) {
  const filter = await hookFilterService.filterChildrenRead({
    hookId: req.params.hookId,
    filterParentId: req.params.filterParentId,
  });

  res.json(filter);
}

export async function filterCreate(req: Request<any, any>, res) {
  const filter = await hookFilterService.filterCreate({
    filter: req.body,
    hookId: req.params.hookId,
  });

  res.json(filter);
}

export async function filterUpdate(req, res) {
  const filter = await hookFilterService.filterUpdate({
    filterId: req.params.filterId,
    filter: req.body,
    hookId: req.params.hookId,
  });

  res.json(filter);
}

export async function filterDelete(req: Request, res: Response) {
  const filter = await hookFilterService.filterDelete({
    filterId: req.params.filterId,
  });
  T.emit('evt', { evt_type: 'hookFilter:deleted' });
  res.json(filter);
}

const router = Router({ mergeParams: true });
router.get(
  '/hooks/:hookId/filters/',
  metaApiMetrics,
  ncMetaAclMw(filterList, 'filterList')
);
router.post(
  '/hooks/:hookId/filters/',
  metaApiMetrics,
  ncMetaAclMw(filterCreate, 'filterCreate')
);
router.get(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterGet, 'filterGet')
);
router.patch(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterUpdate, 'filterUpdate')
);
router.delete(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterDelete, 'filterDelete')
);
router.get(
  '/hooks/:hookId/filters/:filterParentId/children',
  metaApiMetrics,
  ncMetaAclMw(filterChildrenRead, 'filterChildrenRead')
);
export default router;
