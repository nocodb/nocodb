import { Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { viewColumnService } from '../services';
import type { Request, Response } from 'express';

export async function columnList(req: Request, res: Response) {
  res.json(await viewColumnService.columnList({ viewId: req.params.viewId }));
}

export async function columnAdd(req: Request, res: Response) {
  const viewColumn = await viewColumnService.columnAdd({
    viewId: req.params.viewId,
    columnId: req.body.fk_column_id,
    column: {
      ...req.body,
      view_id: req.params.viewId,
    },
  });
  res.json(viewColumn);
}

export async function columnUpdate(req: Request, res: Response) {
  const result = await viewColumnService.columnUpdate({
    viewId: req.params.viewId,
    columnId: req.params.columnId,
    column: req.body,
  });
  res.json(result);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/views/:viewId/columns/',
  metaApiMetrics,
  ncMetaAclMw(columnList, 'columnList')
);
router.post(
  '/api/v1/db/meta/views/:viewId/columns/',
  metaApiMetrics,
  ncMetaAclMw(columnAdd, 'columnAdd')
);
router.patch(
  '/api/v1/db/meta/views/:viewId/columns/:columnId',
  metaApiMetrics,
  ncMetaAclMw(columnUpdate, 'viewColumnUpdate')
);
export default router;
