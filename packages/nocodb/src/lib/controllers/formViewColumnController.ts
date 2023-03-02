import { Request, Response, Router } from 'express';
import FormViewColumn from '../models/FormViewColumn';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';

export async function columnUpdate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'formViewColumn:updated' });
  res.json(await FormViewColumn.update(req.params.formViewColumnId, req.body));
}

const router = Router({ mergeParams: true });
router.patch(
  '/api/v1/db/meta/form-columns/:formViewColumnId',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/FormColumnReq'),
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);
export default router;
