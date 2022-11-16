import { Request, Response, Router } from 'express';
import GridViewColumn from '../../models/GridViewColumn';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function columnList(req: Request, res: Response) {
  res.json(await GridViewColumn.list(req.params.gridViewId));
}

export async function gridColumnUpdate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'gridViewColumn:updated' });
  res.json(await GridViewColumn.update(req.params.gridViewColumnId, req.body));
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
