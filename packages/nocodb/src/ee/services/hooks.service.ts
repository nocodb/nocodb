import { Injectable } from '@nestjs/common';
import { HooksService as HooksServiceCE } from 'src/services/hooks.service';
import type { HookReqType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Model } from '~/models';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import {NcRequest} from "~/interface/config";

@Injectable()
export class HooksService extends HooksServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async hookCreate(param: { tableId: string; hook: HookReqType; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/HookReq', param.hook);

    const model = await Model.get(param.tableId);

    if (!model) {
      NcError.notFound('Table not found');
    }

    const workspaceId = await getWorkspaceForBase(model.base_id);

    const webhooksInTable = await Noco.ncMeta.metaCount(
      null,
      null,
      MetaTable.HOOKS,
      {
        condition: {
          fk_model_id: model.id,
        },
      },
    );

    const webhookLimitForWorkspace = await getLimit(
      PlanLimitTypes.WEBHOOK_LIMIT,
      workspaceId,
    );

    if (webhooksInTable >= webhookLimitForWorkspace) {
      NcError.badRequest(
        `Only ${webhookLimitForWorkspace} webhooks are allowed, for more please upgrade your plan`,
      );
    }

    return await super.hookCreate(param);
  }
}
