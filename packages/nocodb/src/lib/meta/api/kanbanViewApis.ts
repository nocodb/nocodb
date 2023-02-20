import { Request, Response, Router } from 'express';
import { KanbanType, ViewTypes } from 'nocodb-sdk';
import View from '../../models/View';
import KanbanView from '../../models/KanbanView';
import { Tele } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function kanbanViewGet(req: Request, res: Response<KanbanType>) {
  res.json(await KanbanView.get(req.params.kanbanViewId));
}

export async function kanbanViewCreate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'kanban' });
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.KANBAN,
  });
  res.json(view);
}

export async function kanbanViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'kanban' });
  res.json(await KanbanView.update(req.params.kanbanViewId, req.body));
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/meta/tables/:tableId/kanbans',
  metaApiMetrics,
  ncMetaAclMw(kanbanViewCreate, 'kanbanViewCreate')
);
router.patch(
  '/api/v1/db/meta/kanbans/:kanbanViewId',
  metaApiMetrics,
  ncMetaAclMw(kanbanViewUpdate, 'kanbanViewUpdate')
);
router.get(
  '/api/v1/db/meta/kanbans/:kanbanViewId',
  metaApiMetrics,
  ncMetaAclMw(kanbanViewGet, 'kanbanViewGet')
);
export default router;
