import { Inject, Injectable, Logger } from '@nestjs/common';
import { HooksService as HooksServiceCE } from 'src/services/hooks.service';
import type { OnModuleInit } from '@nestjs/common';
import type { HookReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import { DatasService } from '~/services/datas.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { JobTypes } from '~/interface/Jobs';
import { HookSubscribersService } from '~/services/hook-subscribers.service';

@Injectable()
export class HooksService extends HooksServiceCE implements OnModuleInit {
  private logger = new Logger(HooksService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly datasService: DatasService,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly nocoJobsService: NocoJobsService,
    protected readonly hookSubscribersService: HookSubscribersService,
  ) {
    super(appHooksService, datasService, jobsService);
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
        condition: {
          fk_model_id: model.id,
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
        condition: {
          fk_workspace_id: context.workspace_id,
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

  async hookDelete(
    context: NcContext,
    param: { hookId: string; req: NcRequest },
  ) {
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

    return await super.hookDelete(context, param);
  }
}
