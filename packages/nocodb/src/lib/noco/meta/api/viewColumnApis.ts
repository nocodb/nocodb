import { Request, Response, Router } from 'express';
import View from '../../../noco-models/View';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';

export async function columnList(req: Request, res: Response) {
  res.json(await View.getColumns(req.params.viewId));
}
export async function columnAdd(req: Request, res: Response) {
  const viewColumn = await View.insertOrUpdateColumn(
    req.params.viewId,
    req.body.fk_column_id,
    {
      ...req.body,
      view_id: req.params.viewId
    }
  );
  Tele.emit('evt', { evt_type: 'viewColumn:inserted' });

  res.json(viewColumn);
}

export async function columnUpdate(req: Request, res: Response) {
  const result = await View.updateColumn(
    req.params.viewId,
    req.params.columnId,
    req.body
  );
  Tele.emit('evt', { evt_type: 'viewColumn:updated' });
  res.json(result);
}

const router = Router({ mergeParams: true });
router.get('/views/:viewId/columns/', ncMetaAclMw(columnList));
router.post('/views/:viewId/columns/', ncMetaAclMw(columnAdd));
router.put(
  '/views/:viewId/columns/:columnId',
  ncMetaAclMw(columnUpdate, 'viewColumnUpdate')
);
export default router;
