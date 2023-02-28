import { Tele } from 'nc-help';
import { Hook, Model } from '../models';
import { HookReqType, HookTestReqType } from 'nocodb-sdk';

import { invokeWebhook } from '../meta/helpers/webhookHelpers';
import populateSamplePayload from '../meta/helpers/populateSamplePayload';

export async function hookList(param: { tableId: string }) {
  // todo: pagination
  return await Hook.list({ fk_model_id: param.tableId });
}

export async function hookCreate(param: {
  tableId: string;
  hook: HookReqType;
}) {
  Tele.emit('evt', { evt_type: 'webhooks:created' });
  const hook = await Hook.insert({
    ...param.hook,
    fk_model_id: param.tableId,
  });
  return hook;
}

export async function hookDelete(param: { hookId: string }) {
  Tele.emit('evt', { evt_type: 'webhooks:deleted' });
  await Hook.delete(param.hookId);
  return true;
}

export async function hookUpdate(param: { hookId: string; hook: HookReqType }) {
  Tele.emit('evt', { evt_type: 'webhooks:updated' });

  return await Hook.update(param.hookId, param.hook);
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

  return true;
}
export async function tableSampleData(param: {
  tableId: string;
  operation: 'insert' | 'update';
}) {
  const model = await Model.getByIdOrName({ id: param.tableId });

  return await populateSamplePayload(model, false, param.operation);
}
