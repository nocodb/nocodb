import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { HookReqType, HookTestReqType, HookType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  populateSamplePayload,
  populateSamplePayloadV2,
} from '~/helpers/populateSamplePayload';
import { invokeWebhook } from '~/helpers/webhookHelpers';
import { Hook, HookLog, Model } from '~/models';
import { DatasService } from '~/services/datas.service';

@Injectable()
export class HooksService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly dataService: DatasService,
  ) {}

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

  async hookList(context: NcContext, param: { tableId: string }) {
    return await Hook.list(context, { fk_model_id: param.tableId });
  }

  async hookLogList(context: NcContext, param: { query: any; hookId: string }) {
    return await HookLog.list(
      context,
      { fk_hook_id: param.hookId },
      param.query,
    );
  }

  async hookCreate(
    context: NcContext,
    param: {
      tableId: string;
      hook: HookReqType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    this.validateHookPayload(param.hook.notification);

    const hook = await Hook.insert(context, {
      ...param.hook,
      fk_model_id: param.tableId,
    } as any);

    this.appHooksService.emit(AppEvents.WEBHOOK_CREATE, {
      hook,
      req: param.req,
    });

    return hook;
  }

  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest },
  ) {
    const hook = await Hook.get(context, param.hookId);

    if (!hook) {
      NcError.hookNotFound(param.hookId);
    }

    const isHookUsed = await Hook.isWebHookUsed(context, param.hookId);

    if (isHookUsed) {
      NcError.badRequest('Webhook is used in some Button or Automation');
    }

    await Hook.delete(context, param.hookId);
    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
      req: param.req,
    });
    return true;
  }

  async hookUpdate(
    context: NcContext,
    param: {
      hookId: string;
      hook: HookReqType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    const hook = await Hook.get(context, param.hookId);

    if (!hook) {
      NcError.hookNotFound(param.hookId);
    }

    this.validateHookPayload(param.hook.notification);

    if (hook.active && !param.hook.active) {
      const isHookUsed = await Hook.isWebHookUsed(context, param.hookId);
      if (isHookUsed) {
        NcError.badRequest('Webhook is used in some Button or Automation');
      }
    }

    const res = await Hook.update(context, param.hookId, param.hook);

    this.appHooksService.emit(AppEvents.WEBHOOK_UPDATE, {
      hook: {
        ...hook,
        ...param.hook,
      },
      req: param.req,
    });

    return res;
  }

  async hookTrigger(
    context: NcContext,
    param: {
      req: NcRequest;
      hookId: string;
      rowId: string;
    },
  ) {
    const hook = await Hook.get(context, param.hookId);

    if (!hook && hook.event !== 'manual') {
      NcError.badRequest('Hook not found');
    }

    const row = await this.dataService.dataRead(context, {
      rowId: param.rowId,
      query: {},
      baseName: hook.base_id,
      tableName: hook.fk_model_id,
    });

    if (!row) {
      NcError.badRequest('Row not found');
    }

    const model = await Model.get(context, hook.fk_model_id);

    await invokeWebhook(context, {
      hook: hook,
      model: model,
      view: null,
      prevData: null,
      newData: row,
      user: param.req.user,
      testFilters: (hook as any)?.filters,
      throwErrorOnFailure: true,
      testHook: false,
    });

    /*    this.appHooksService.emit(AppEvents.WEBHOOK_TRIGGER, {
      hook,
      req: param.req,
    });*/

    return true;
  }

  async hookTest(
    context: NcContext,
    param: {
      tableId: string;
      hookTest: HookTestReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/HookTestReq',
      param.hookTest,
    );

    this.validateHookPayload(param.hookTest.hook?.notification);

    const model = await Model.getByIdOrName(context, { id: param.tableId });

    const {
      hook,
      payload: { data, user },
    } = param.hookTest;
    try {
      await invokeWebhook(context, {
        hook: new Hook(hook),
        model: model,
        view: null,
        prevData: null,
        newData: data,
        user: user,
        testFilters: (hook as any)?.filters,
        throwErrorOnFailure: true,
        testHook: true,
      });
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

  async tableSampleData(
    context: NcContext,
    param: {
      tableId: string;
      operation: HookType['operation'];
      version: any; // HookType['version'];
    },
  ) {
    const model = new Model(
      await Model.getByIdOrName(context, { id: param.tableId }),
    );

    if (param.version === 'v1') {
      return await populateSamplePayload(
        context,
        model,
        false,
        param.operation,
      );
    }
    return await populateSamplePayloadV2(
      context,
      model,
      false,
      param.operation,
    );
  }

  async hookLogCount(context: NcContext, param: { hookId: string }) {
    return await HookLog.count(context, { hookId: param.hookId });
  }
}
