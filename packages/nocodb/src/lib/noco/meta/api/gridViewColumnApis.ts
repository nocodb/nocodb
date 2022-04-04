import { Request, Response, Router } from 'express';
import GridViewColumn from '../../../noco-models/GridViewColumn';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';

export async function columnList(req: Request, res: Response) {
  res.json(await GridViewColumn.list(req.params.gridViewId));
}

export async function gridColumnUpdate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'gridViewColumn:updated' });
  res.json(await GridViewColumn.update(req.params.gridViewColumnId, req.body));
}

const router = Router({ mergeParams: true });
router.get('/grid/:gridViewId/gridColumns', ncMetaAclMw(columnList));
router.put('/gridColumns/:gridViewColumnId', ncMetaAclMw(gridColumnUpdate));
export default router;
