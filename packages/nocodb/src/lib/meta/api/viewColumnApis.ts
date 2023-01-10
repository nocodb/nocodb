import { Request, Response, Router } from 'express';
import View from '../../models/View';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function columnList(req: Request, res: Response) {
  res.json(await View.getColumns(req.params.viewId));
}
export async function columnAdd(req: Request, res: Response) {
  const viewColumn = await View.insertOrUpdateColumn(
    req.params.viewId,
    req.body.fk_column_id,
    {
      ...req.body,
      view_id: req.params.viewId,
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
