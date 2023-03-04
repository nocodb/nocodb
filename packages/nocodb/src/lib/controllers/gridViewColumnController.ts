import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { gridViewColumnService } from '../services';

export async function columnList(req: Request, res: Response) {
  res.json(
    await gridViewColumnService.columnList({
      gridViewId: req.params.gridViewId,
    })
  );
}

export async function gridColumnUpdate(req: Request, res: Response) {
  res.json(
    await gridViewColumnService.gridColumnUpdate({
      gridViewColumnId: req.params.gridViewColumnId,
      grid: req.body,
    })
  );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/grids/:gridViewId/grid-columns',
  metaApiMetrics,
  ncMetaAclMw(columnList, 'columnList')
);
router.patch(
  '/api/v1/db/meta/grid-columns/:gridViewColumnId',
  metaApiMetrics,
  ncMetaAclMw(gridColumnUpdate, 'gridColumnUpdate')
);
export default router;
