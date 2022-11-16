import { Tele } from 'nc-help';
import catchError from '../helpers/catchError';
import { Request, Response, Router } from 'express';
import Hook from '../../models/Hook';
import { HookListType, HookType } from 'nocodb-sdk';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { invokeWebhook } from '../helpers/webhookHelpers';
import Model from '../../models/Model';
import populateSamplePayload from '../helpers/populateSamplePayload';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

export async function hookList(
  req: Request<any, any, any>,
  res: Response<HookListType>
) {
  // todo: pagination
  res.json(
    new PagedResponseImpl(await Hook.list({ fk_model_id: req.params.tableId }))
  );
}

export async function hookCreate(
  req: Request<any, HookType>,
  res: Response<HookType>
) {
  Tele.emit('evt', { evt_type: 'webhooks:created' });
  const hook = await Hook.insert({
    ...req.body,
    fk_model_id: req.params.tableId,
  });
  res.json(hook);
}

export async function hookDelete(
  req: Request<any, HookType>,
  res: Response<any>
) {
  Tele.emit('evt', { evt_type: 'webhooks:deleted' });
  res.json(await Hook.delete(req.params.hookId));
}

export async function hookUpdate(
  req: Request<any, HookType>,
  res: Response<HookType>
) {
  Tele.emit('evt', { evt_type: 'webhooks:updated' });

  res.json(await Hook.update(req.params.hookId, req.body));
}

export async function hookTest(req: Request<any, any>, res: Response) {
  const model = await Model.getByIdOrName({ id: req.params.tableId });

  const {
    hook,
    payload: { data, user },
  } = req.body;
  await invokeWebhook(
    new Hook(hook),
    model,
    data,
    user,
    (hook as any)?.filters,
    true
  );

  Tele.emit('evt', { evt_type: 'webhooks:tested' });

  res.json({ msg: 'Success' });
}
export async function tableSampleData(req: Request, res: Response) {
  const model = await Model.getByIdOrName({ id: req.params.tableId });

  res // todo: pagination
    .json(await populateSamplePayload(model, false, req.params.operation));
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks',
  metaApiMetrics,
  ncMetaAclMw(hookList, 'hookList')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks/test',
  metaApiMetrics,
  ncMetaAclMw(hookTest, 'hookTest')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks',
  metaApiMetrics,
  ncMetaAclMw(hookCreate, 'hookCreate')
);
router.delete(
  '/api/v1/db/meta/hooks/:hookId',
  metaApiMetrics,
  ncMetaAclMw(hookDelete, 'hookDelete')
);
router.patch(
  '/api/v1/db/meta/hooks/:hookId',
  metaApiMetrics,
  ncMetaAclMw(hookUpdate, 'hookUpdate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation',
  metaApiMetrics,
  catchError(tableSampleData)
);
export default router;
