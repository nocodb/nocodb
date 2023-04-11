import { Injectable } from '@nestjs/common';
import { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { NcError } from '../../helpers/catchError';
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '../../helpers/populateSamplePayload';
import { invokeWebhook } from '../../helpers/webhookHelpers';
import { Hook, HookLog, Model } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class HooksService {
  validateHookPayload(notificationJsonOrObject: string | Record<string, any>) {
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

  async hookList(param: { tableId: string }) {
    return await Hook.list({ fk_model_id: param.tableId });
  }

  async hookLogList(param: { query: any; hookId: string }) {
    return await HookLog.list({ fk_hook_id: param.hookId }, param.query);
  }

  async hookCreate(param: { tableId: string; hook: HookReqType }) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    this.validateHookPayload(param.hook.notification);

    const hook = await Hook.insert({
      ...param.hook,
      fk_model_id: param.tableId,
    } as any);

    T.emit('evt', { evt_type: 'webhooks:created' });

    return hook;
  }

  async hookDelete(param: { hookId: string }) {
    T.emit('evt', { evt_type: 'webhooks:deleted' });
    await Hook.delete(param.hookId);
    return true;
  }

  async hookUpdate(param: { hookId: string; hook: HookReqType }) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    T.emit('evt', { evt_type: 'webhooks:updated' });

    this.validateHookPayload(param.hook.notification);

    return await Hook.update(param.hookId, param.hook);
  }

  async hookTest(param: { tableId: string; hookTest: HookTestReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/HookTestReq',
      param.hookTest,
    );

    this.validateHookPayload(param.hookTest.hook?.notification);

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
        true,
        true,
      );
    } catch (e) {
      throw e;
    }

    return true;
  }

  async tableSampleData(param: {
    tableId: string;
    operation: HookType['operation'];
    version: any; // HookType['version'];
  }) {
    const model = await Model.getByIdOrName({ id: param.tableId });

    if (param.version === 'v1') {
      return await populateSamplePayload(model, false, param.operation);
    }
    return await populateSamplePayloadV2(model, false, param.operation);
  }

  async hookLogCount(param: { hookId: string }) {
    return await HookLog.count({ hookId: param.hookId });
  }
}
