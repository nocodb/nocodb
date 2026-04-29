import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppEvents, MetaEventType } from 'nocodb-sdk';
import { HooksService as HooksServiceCE } from 'src/services/hooks.service';
import type { OnModuleInit } from '@nestjs/common';
import type { HookReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import {
  HookCreateContract,
  HookUpdateContract,
  HookDeleteContract,
} from '~/command-registry/operations/hooks.operations';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Hook, Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import { DatasService } from '~/services/datas.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';
import { HookSubscribersService } from '~/services/hook-subscribers.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';

@Injectable()
export class HooksService extends HooksServiceCE implements OnModuleInit {
  private logger = new Logger(HooksService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly datasService: DatasService,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly hookSubscribersService: HookSubscribersService,
    protected readonly baseTrashService: BaseTrashService,
    protected readonly metaDependencyEventHandler: MetaDependencyEventHandler,
  ) {
    super(
      appHooksService,
      datasService,
      jobsService,
      metaDependencyEventHandler,
    );
  }

  async onModuleInit() {
    this.nocoJobsService.jobsQueue.add(
      {
        jobName: JobTypes.HookErrorNotification,
      },
      {
        jobId: JobTypes.HookErrorNotification,
        repeat: { cron: '* * * * *' },
      },
    );
  }

  @EEOnly()
  @TraceCommand(HookCreateContract)
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
    if (!option?.isTableDuplicate) {
      validatePayload('swagger.json#/components/schemas/HookReq', param.hook);
    }

    const model = await Model.get(context, param.tableId);

    if (!model) {
      NcError.tableNotFound(param.tableId);
    }

    const webhooksInTable = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.HOOKS,
      {
        condition: { fk_model_id: model.id },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit: webhookLimitPerTable, plan } = await getLimit(
      PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE,
      context.workspace_id,
    );

    if (webhooksInTable >= webhookLimitPerTable) {
      NcError.planLimitExceeded(
        `Only ${webhookLimitPerTable} webhooks are allowed, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: webhookLimitPerTable,
          current: webhooksInTable,
        },
      );
    }

    const webhooksInWorkspace = await Noco.ncMeta.metaCount(
      context.workspace_id,
      RootScopes.WORKSPACE,
      MetaTable.HOOKS,
      {
        condition: { fk_workspace_id: context.workspace_id },
        xcCondition: {
          _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
        },
      },
    );

    const { limit: webhookLimitForWorkspace } = await getLimit(
      PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE,
      context.workspace_id,
    );

    if (webhooksInWorkspace >= webhookLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${webhookLimitForWorkspace} webhooks are allowed, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: webhookLimitForWorkspace,
          current: webhooksInWorkspace,
        },
      );
    }

    const hook = await super.hookCreate(context, param, option);

    if (hook?.id && param.req?.user?.id) {
      try {
        await this.hookSubscribersService.addSubscribers(context, hook.id, [
          param.req.user.id,
        ]);
      } catch (e: any) {
        this.logger.error(
          `Failed to add hook creator as subscriber: ${e.message}`,
          e.stack,
        );
      }
    }

    return hook;
  }

  @EEOnly()
  @TraceCommand(HookUpdateContract)
  async hookUpdate(
    context: NcContext,
    param: {
      hookId: string;
      hook: HookReqType;
      req: NcRequest;
    },
  ) {
    return super.hookUpdate(context, param);
  }

  @EEOnly()
  @TraceCommand(HookDeleteContract)
  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest; skipTrash?: boolean },
    ncMeta?: MetaService,
  ) {
    // `skipTrash: true` is set by `HookTrashHandler.permanentDelete` to bypass
    // the trash flow and run the CE hard-delete directly.
    if (param.skipTrash) {
      return super.hookDelete(context, param, ncMeta);
    }

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const hook = await Hook.get(context, param.hookId, false, ncMeta);
    if (!hook) {
      NcError.get(context).hookNotFound(param.hookId);
    }

    try {
      await this.hookSubscribersService.deleteAllSubscribers(
        context,
        param.hookId,
      );
    } catch (e: any) {
      this.logger.error(
        `Failed to delete hook subscribers: ${e.message}`,
        e.stack,
      );
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.hookId,
      resourceType: 'hook',
      user: param.req.user,
      req: param.req,
      ncMeta,
    });

    await this.metaDependencyEventHandler.handleEvent(
      context,
      {
        eventType: MetaEventType.HOOK_DELETED,
        oldEntity: hook,
      },
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.WEBHOOK_DELETE, {
      hook,
      req: param.req,
      context,
      tableId: hook.fk_model_id,
    });
    return true;
  }
}
