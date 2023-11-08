import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '~/helpers/populateSamplePayload';
import { invokeWebhook } from '~/helpers/webhookHelpers';
import { Hook, HookLog, Model } from '~/models';

@Injectable()
export class HooksService {
  constructor(protected readonly appHooksService: AppHooksService) {}

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

  async hookCreate(param: {
    tableId: string;
    hook: HookReqType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    this.validateHookPayload(param.hook.notification);

    const hook = await Hook.insert({
      ...param.hook,
      fk_model_id: param.tableId,
    } as any);

    this.appHooksService.emit(AppEvents.WEBHOOK_CREATE, {
      hook,
      req: param.req,
    });

    return hook;
  }

  async hookDelete(param: { hookId: string; req: NcRequest }) {
    const hook = await Hook.get(param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    await Hook.delete(param.hookId);
    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
      req: param.req,
    });
    return true;
  }

  async hookUpdate(param: {
    hookId: string;
    hook: HookReqType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    const hook = await Hook.get(param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    this.validateHookPayload(param.hook.notification);

    const res = await Hook.update(param.hookId, param.hook);

    this.appHooksService.emit(AppEvents.WEBHOOK_UPDATE, {
      hook: {
        ...hook,
        ...param.hook,
      },
      req: param.req,
    });

    return res;
  }

  async hookTest(param: {
    tableId: string;
    hookTest: HookTestReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/HookTestReq',
      param.hookTest,
    );

    this.validateHookPayload(param.hookTest.hook?.notification);

    const model = await Model.getByIdOrName({ id: param.tableId });

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
    } finally {
      this.appHooksService.emit(AppEvents.WEBHOOK_TEST, {
        hook,
        req: param.req,
      });
    }

    return true;
  }

  async tableSampleData(param: {
    tableId: string;
    operation: HookType['operation'];
    version: any; // HookType['version'];
  }) {
    const model = new Model(await Model.getByIdOrName({ id: param.tableId }));

    if (param.version === 'v1') {
      return await populateSamplePayload(model, false, param.operation);
    }
    return await populateSamplePayloadV2(model, false, param.operation);
  }

  async hookLogCount(param: { hookId: string }) {
    return await HookLog.count({ hookId: param.hookId });
  }
}
