import catchError from '../helpers/catchError';
import { Request, Response, Router } from 'express';

import { Tele } from 'nc-help';
import SyncSource from '../../../../noco-models/SyncSource';
import { PagedResponseImpl } from '../../helpers/PagedResponse';

export async function syncSourceList(req: Request, res: Response) {
  // todo: pagination
  res.json(new PagedResponseImpl(await SyncSource.list()));
}

export async function syncCreate(req: Request, res: Response) {
  Tele.emit('evt', { evt_type: 'webhooks:created' });
  const sync = await Hook.insert({
    ...req.body,
    fk_model_id: req.params.tableId
  });
  res.json(hook);
}

export async function syncDelete(
  req: Request<any, HookType>,
  res: Response<any>
) {
  Tele.emit('evt', { evt_type: 'webhooks:deleted' });
  res.json(await Hook.delete(req.params.hookId));
}

export async function syncUpdate(
  req: Request<any, HookType>,
  res: Response<HookType>
) {
  Tele.emit('evt', { evt_type: 'webhooks:updated' });

  res.json(await Hook.update(req.params.hookId, req.body));
}

export async function syncTest(req: Request<any, any>, res: Response) {
  const model = await Model.getByIdOrName({ id: req.params.tableId });

  const {
    sync,
    payload: { data, user }
  } = req.body;
  await invokeWebhook(
    new Hook(hook),
    model,
    data,
    user,
    (hook as any)?.filters
  );

  Tele.emit('evt', { evt_type: 'webhooks:tested' });

  res.json({ msg: 'Success' });
}
export async function tableSampleData(req: Request, res: Response) {
  const model = await Model.getByIdOrName({ id: req.params.tableId });

  res // todo: pagination
    .json(await populateSamplePayload(model, true, req.params.operation));
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks',
  ncMetaAclMw(hookList, 'hookList')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks/test',
  ncMetaAclMw(hookTest, 'hookTest')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks',
  ncMetaAclMw(hookCreate, 'hookCreate')
);
router.delete(
  '/api/v1/db/meta/hooks/:hookId',
  ncMetaAclMw(hookDelete, 'hookDelete')
);
router.patch(
  '/api/v1/db/meta/hooks/:hookId',
  ncMetaAclMw(hookUpdate, 'hookUpdate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation',
  catchError(tableSampleData)
);
export default router;
