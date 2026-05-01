import { Injectable } from '@nestjs/common';
import { SortsService as SortsServiceCE } from 'src/services/sorts.service';
import type { SortReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { assertNotLockedViewOnSandboxProduction } from '~/helpers/sandboxGuards';
import { Sort, View } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';

@Injectable()
export class SortsService extends SortsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @EEOnly()
  @TraceCommand(OperationName.sortCreate)
  async sortCreate(
    context: NcContext,
    param: {
      viewId: any;
      sort: SortReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    await assertNotLockedViewOnSandboxProduction(context, param.viewId);

    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const view = await View.get(context, param.viewId, false, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const sortsInView = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      {
        condition: {
          fk_view_id: view.id,
        },
      },
    );

    const { limit: sortLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_SORT_PER_VIEW,
      context.workspace_id,
    );

    if (sortsInView >= sortLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${sortLimitForWorkspace} sorts are allowed, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: sortLimitForWorkspace,
          current: sortsInView,
        },
      );
    }

    return super.sortCreate(context, param, ncMeta);
  }

  @EEOnly()
  @TraceCommand(OperationName.sortUpdate)
  async sortUpdate(
    context: NcContext,
    param: {
      sortId: any;
      sort: SortReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    const sort = await Sort.get(context, param.sortId, ncMeta);
    if (sort?.fk_view_id) {
      await assertNotLockedViewOnSandboxProduction(context, sort.fk_view_id);
    }
    return super.sortUpdate(context, param, ncMeta);
  }

  @EEOnly()
  @TraceCommand(OperationName.sortDelete)
  async sortDelete(
    context: NcContext,
    param: {
      sortId: string;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    const sort = await Sort.get(context, param.sortId, ncMeta);
    if (sort?.fk_view_id) {
      await assertNotLockedViewOnSandboxProduction(context, sort.fk_view_id);
    }
    return super.sortDelete(context, param, ncMeta);
  }
}
