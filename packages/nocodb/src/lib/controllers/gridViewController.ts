import { Request, Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { gridViewService } from '../services';

export async function gridViewCreate(req: Request<any>, res) {
  const view = await gridViewService.gridViewCreate({
    grid: req.body,
    tableId: req.params.tableId,
  });
  res.json(view);
}

export async function gridViewUpdate(req, res) {
  res.json(
    await gridViewService.gridViewUpdate({
      viewId: req.params.viewId,
      grid: req.body,
    })
  );
}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/grids/',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/GridReq'),
  ncMetaAclMw(gridViewCreate, 'gridViewCreate')
);
router.patch(
  '/api/v1/db/meta/grids/:viewId',
  metaApiMetrics,
  ncMetaAclMw(gridViewUpdate, 'gridViewUpdate')
);
export default router;
