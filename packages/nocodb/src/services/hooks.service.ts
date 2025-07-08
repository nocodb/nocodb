import { Inject, Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import View from '../models/View';
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
import { ButtonColumn, Hook, HookLog, Model } from '~/models';
import { DatasService } from '~/services/datas.service';
import { JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

const SUPPORTED_HOOK_VERSION = ['v3'];

@Injectable()
export class HooksService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly dataService: DatasService,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
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
    option?: {
      isTableDuplicate?: boolean;
    },
  ) {
    // if isTableDuplicate, we let v2 to be created
    if (
      !option?.isTableDuplicate &&
      !SUPPORTED_HOOK_VERSION.includes((param.hook as any).version)
    ) {
      NcError.badRequest('hook version is deprecated / not supported anymore');
    }

    if (!param.hook?.trigger_field) {
      param.hook.trigger_field = false;
    }

    if (!option?.isTableDuplicate) {
      validatePayload('swagger.json#/components/schemas/HookReq', param.hook);
    }
    this.validateHookPayload(param.hook.notification);

    // if version is not in SUPPORTED_HOOK_VERSION, that means it's a duplicate table activity
    // then we use v2 insert
    // otherwise v3 insert
    const hook = !SUPPORTED_HOOK_VERSION.includes((param.hook as any).version)
      ? await Hook.insertV2(context, {
          ...param.hook,
          fk_model_id: param.tableId,
        } as any)
      : await Hook.insert(context, {
          ...param.hook,
          fk_model_id: param.tableId,
        } as any);

    this.appHooksService.emit(AppEvents.WEBHOOK_CREATE, {
      hook,
      req: param.req,
      context,
      tableId: hook.fk_model_id,
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

    const buttonCols = await Hook.hookUsages(context, param.hookId);

    if (buttonCols.length) {
      for (const button of buttonCols) {
        await ButtonColumn.update(context, button.fk_column_id, {
          fk_webhook_id: null,
        });
      }
      await View.clearSingleQueryCache(context, hook.fk_model_id);
    }

    await Hook.delete(context, param.hookId);

    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
      req: param.req,
      context,
      tableId: hook.fk_model_id,
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
    if (!SUPPORTED_HOOK_VERSION.includes((param.hook as any).version)) {
      NcError.badRequest('hook version is deprecated / not supported anymore');
    }

    if (!param.hook?.trigger_field) {
      param.hook.trigger_field = false;
    }

    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    const hook = await Hook.get(context, param.hookId);

    if (!hook) {
      NcError.hookNotFound(param.hookId);
    }

    this.validateHookPayload(param.hook.notification);

    // If the webhook is being changed to manual trigger, set it to active
    if (param.hook.event === 'manual') {
      param.hook.active = true;
    }

    if (
      (hook.active && !param.hook.active) ||
      hook.event !== param.hook.event
    ) {
      const buttonCols = await Hook.hookUsages(context, param.hookId);
      if (buttonCols.length) {
        for (const button of buttonCols) {
          await ButtonColumn.update(context, button.fk_column_id, {
            fk_webhook_id: null,
          });
        }
      }
      await View.clearSingleQueryCache(context, hook.fk_model_id);
    }

    const res = await Hook.update(context, param.hookId, param.hook);

    this.appHooksService.emit(AppEvents.WEBHOOK_UPDATE, {
      hook: {
        ...hook,
        ...param.hook,
      },
      oldHook: hook,
      tableId: hook.fk_model_id,
      req: param.req,
      context,
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

    try {
      await this.jobsService.add(JobTypes.HandleWebhook, {
        hookId: hook.id,
        modelId: model.id,
        viewId: null,
        prevData: null,
        newData: row,
        user: param.req.user,
        context,
        hookName: 'manual.trigger',
      });
    } catch (e) {
      throw e;
    } finally {
      /*this.appHooksService.emit(AppEvents.WEBHOOK_TRIGGER, {
        hook,
        req: param.req,
      });*/
    }

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
        prevData: data?.previous_rows ?? null,
        newData: data.rows,
        user: user,
        testFilters: (hook as any)?.filters,
        throwErrorOnFailure: true,
        testHook: true,
        hookName: hook.event + '.' + hook.operation[0],
      });
    } catch (e) {
      throw e;
    } finally {
      this.appHooksService.emit(AppEvents.WEBHOOK_TEST, {
        hook,
        req: param.req,
        context,
        tableId: hook.fk_model_id,
      });
    }

    return true;
  }

  async hookSamplePayload(
    context: NcContext,
    param: {
      tableId: string;
      operation: string;
      version: string;
      includeUser?: boolean;
      user?: any;
    },
  ) {
    const model = await Model.getByIdOrName(context, { id: param.tableId });

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
      'records',
      param.includeUser,
      param.user,
    );
  }

  async tableSampleData(
    context: NcContext,
    param: {
      tableId: string;
      operation: HookType['operation'][number];
      version: any; // HookType['version'];
      includeUser?: boolean;
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
      undefined,
      param.includeUser,
      undefined,
      param.version,
    );
  }

  async hookLogCount(context: NcContext, param: { hookId: string }) {
    return await HookLog.count(context, { hookId: param.hookId });
  }
}
