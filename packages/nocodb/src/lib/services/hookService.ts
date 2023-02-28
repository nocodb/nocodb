import { Tele } from 'nc-help';
import catchError from '../helpers/catchError';
import { Request, Response, Router } from 'express';
import { Hook, Model } from '../models';
import { HookListType, HookReqType, HookTestReqType, HookType, TableReqType } from 'nocodb-sdk'
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { invokeWebhook } from '../helpers/webhookHelpers';
import populateSamplePayload from '../helpers/populateSamplePayload';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';
import { getAjvValidatorMw } from './helpers';

export async function hookList(
param: {
  tableId: string;
}
) {
  // todo: pagination
  await Hook.list({ fk_model_id: param.tableId }))
}

export async function hookCreate(
param: {
  tableId: string;
  hook: HookReqType
}
) {
  Tele.emit('evt', { evt_type: 'webhooks:created' });
  const hook = await Hook.insert({
    ...param.hook,
    fk_model_id: param.tableId,
  });
  return hook;
}

export async function hookDelete(
param :{
  hookId: string;
}
) {
  Tele.emit('evt', { evt_type: 'webhooks:deleted' });
  await Hook.delete(param.hookId);
  return true;
}

export async function hookUpdate(
  param: {
    hookId: string;
    hook: HookReqType;
  }
) {
  Tele.emit('evt', { evt_type: 'webhooks:updated' });

  return await Hook.update(param.hookId, param.hook)
}

export async function hookTest(param: {
  tableId: string;
  hookTest: HookTestReqType;
}) {
  const model = await Model.getByIdOrName({ id: param.tableId });

  const {
    hook,
    payload: { data, user },
  } = param.hookTest;
  await invokeWebhook(
    new Hook(hook),
    model,
    data,
    user,
    (hook as any)?.filters,
    true
  );

  Tele.emit('evt', { evt_type: 'webhooks:tested' });

  return true
}
export async function tableSampleData(param:{
  tableId: string;
  operation: 'insert' | 'update';
}) {
  const model = await Model.getByIdOrName({ id: param.tableId });

  return await populateSamplePayload(model, false, param.operation);
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
  getAjvValidatorMw('swagger.json#/components/schemas/HookTestReq'),
  ncMetaAclMw(hookTest, 'hookTest')
);
router.post(
  '/api/v1/db/meta/tables/:tableId/hooks',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/HookReq'),
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
  getAjvValidatorMw('swagger.json#/components/schemas/HookReq'),
  ncMetaAclMw(hookUpdate, 'hookUpdate')
);
router.get(
  '/api/v1/db/meta/tables/:tableId/hooks/samplePayload/:operation',
  metaApiMetrics,
  catchError(tableSampleData)
);
export default router;
