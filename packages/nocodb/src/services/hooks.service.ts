import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '../helpers/populateSamplePayload';
import { invokeWebhook } from '../helpers/webhookHelpers';
import { Hook, HookLog, Model } from '../models';
import Noco from '../Noco';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk';

@Injectable()
export class HooksService {
  constructor(private readonly appHooksService: AppHooksService) {}

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

    this.appHooksService.emit(AppEvents.WEBHOOK_CREATE, {
      hook,
    });

    return hook;
  }

  async hookDelete(param: { hookId: string }) {
    const hook = await Hook.get(param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    await Hook.delete(param.hookId);
    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
    });
    return true;
  }

  async hookUpdate(param: { hookId: string; hook: HookReqType }) {
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
    });

    return res;
  }

  async hookTest(param: { tableId: string; hookTest: HookTestReqType }) {
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
      });
    }

    return true;
  }

  async tableSampleData(param: {
    tableId: string;
    operation: HookType['operation'];
    version: any; // HookType['version'];
  }) {
    const model = await Model.getByIdOrName({ id: param.tableId });

    if (param.version === 'v1' || (param.version === 'v2' && Noco.isEE())) {
      return await populateSamplePayload(model, false, param.operation);
    }
    return await populateSamplePayloadV2(model, false, param.operation);
  }

  async hookLogCount(param: { hookId: string }) {
    return await HookLog.count({ hookId: param.hookId });
  }
}
