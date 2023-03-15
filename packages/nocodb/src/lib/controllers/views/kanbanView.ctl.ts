import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../../meta/helpers/apiMetrics';
import { kanbanViewService } from '../../services';
import type { KanbanType } from 'nocodb-sdk';
import type { Request, Response } from 'express';

export async function kanbanViewGet(req: Request, res: Response<KanbanType>) {
  res.json(
    await kanbanViewService.kanbanViewGet({
      kanbanViewId: req.params.kanbanViewId,
    })
  );
}

export async function kanbanViewCreate(req: Request<any, any>, res) {
  res.json(
    await kanbanViewService.kanbanViewCreate({
      tableId: req.params.tableId,
      kanban: req.body,
    })
  );
}

export async function kanbanViewUpdate(req, res) {
  res.json(
    await kanbanViewService.kanbanViewUpdate({
      kanbanViewId: req.params.kanbanViewId,
      kanban: req.body,
    })
  );
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
