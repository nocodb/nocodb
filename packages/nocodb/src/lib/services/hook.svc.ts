import { T } from 'nc-help';
import { validatePayload } from '../meta/api/helpers';
import { NcError } from '../meta/helpers/catchError';
import { Hook, HookLog, Model } from '../models';
import { invokeWebhook } from '../meta/helpers/webhookHelpers';
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '../meta/helpers/populateSamplePayload';
import type { HookType } from 'nocodb-sdk';
import type { HookReqType, HookTestReqType } from 'nocodb-sdk';

function validateHookPayload(
  notificationJsonOrObject: string | Record<string, any>
) {
  let notification: { type?: string } = {};
  try {
    notification =
      typeof notificationJsonOrObject === 'string'
        ? JSON.parse(notificationJsonOrObject)
        : notificationJsonOrObject;
  } catch {}

  if (notification.type !== 'URL' && process.env.NC_CLOUD === 'true') {
    NcError.badRequest('Only URL notification is supported');
  }
}

export async function hookList(param: { tableId: string }) {
  return await Hook.list({ fk_model_id: param.tableId });
}

export async function hookLogList(param: { query: any; hookId: string }) {
  return await HookLog.list({ fk_hook_id: param.hookId }, param.query);
}

export async function hookCreate(param: {
  tableId: string;
  hook: HookReqType;
}) {
  validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

  validateHookPayload(param.hook.notification);

  const hook = await Hook.insert({
    ...param.hook,
    fk_model_id: param.tableId,
  } as any);

  T.emit('evt', { evt_type: 'webhooks:created' });

  return hook;
}

export async function hookDelete(param: { hookId: string }) {
  T.emit('evt', { evt_type: 'webhooks:deleted' });
  await Hook.delete(param.hookId);
  return true;
}

export async function hookUpdate(param: { hookId: string; hook: HookReqType }) {
  validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

  T.emit('evt', { evt_type: 'webhooks:updated' });

  validateHookPayload(param.hook.notification);

  return await Hook.update(param.hookId, param.hook);
}

export async function hookTest(param: {
  tableId: string;
  hookTest: HookTestReqType;
}) {
  validatePayload(
    'swagger.json#/components/schemas/HookTestReq',
    param.hookTest
  );

  validateHookPayload(param.hookTest.hook?.notification);

  const model = await Model.getByIdOrName({ id: param.tableId });

  T.emit('evt', { evt_type: 'webhooks:tested' });

  const {
    hook,
    payload: { data, user },
  } = param.hookTest;
  try {
    await invokeWebhook(
      new Hook(hook),
      model,
      null,
      null,
      data,
      user,
      (hook as any)?.filters,
      true
    );
  } catch (e) {
    throw e;
  }

  return true;
}

export async function tableSampleData(param: {
  tableId: string;
  operation: HookType['operation'];
  version: HookType['version'];
}) {
  const model = await Model.getByIdOrName({ id: param.tableId });

  if (param.version === 'v1') {
    return await populateSamplePayload(model, false, param.operation);
  }
  return await populateSamplePayloadV2(model, false, param.operation);
}

export async function hookLogCount(param: { hookId: string }) {
  return await HookLog.count({ hookId: param.hookId });
}
