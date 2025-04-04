import { Inject, Injectable } from '@nestjs/common';
import { HooksService as HooksServiceCE } from 'src/services/hooks.service';
import type { HookReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import { DatasService } from '~/services/datas.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Injectable()
export class HooksService extends HooksServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly datasService: DatasService,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {
    super(appHooksService, datasService, jobsService);
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

    return await super.hookCreate(context, param);
  }
}
