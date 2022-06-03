import { Request, Response, Router } from 'express';
import FormViewColumn from '../../models/FormViewColumn';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function columnUpdate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'formViewColumn:updated' });
  res.json(await FormViewColumn.update(req.params.formViewColumnId, req.body));
}

const router = Router({ mergeParams: true });
router.patch(
  '/api/v1/db/meta/form-columns/:formViewColumnId',
  metaApiMetrics,
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);
export default router;
