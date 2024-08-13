import { Injectable } from '@nestjs/common';
import { HooksService as HooksServiceCE } from 'src/services/hooks.service';
import type { HookReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { DatasService } from '~/services/datas.service';

@Injectable()
export class HooksService extends HooksServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly datasService: DatasService,
  ) {
    super(appHooksService, datasService);
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

    const webhookLimitForWorkspace = await getLimit(
      PlanLimitTypes.WEBHOOK_LIMIT,
      context.workspace_id,
    );

    if (webhooksInTable >= webhookLimitForWorkspace) {
      NcError.badRequest(
        `Only ${webhookLimitForWorkspace} webhooks are allowed, for more please upgrade your plan`,
      );
    }

    return await super.hookCreate(context, param);
  }
}
