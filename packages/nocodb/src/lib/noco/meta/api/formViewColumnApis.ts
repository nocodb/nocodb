import { Request, Response, Router } from 'express';
import FormViewColumn from '../../../noco-models/FormViewColumn';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';

export async function columnUpdate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'formViewColumn:updated' });
  res.json(await FormViewColumn.update(req.params.formViewColumnId, req.body));
}

const router = Router({ mergeParams: true });
router.put('/formColumns/:formViewColumnId', ncMetaAclMw(columnUpdate));
export default router;
