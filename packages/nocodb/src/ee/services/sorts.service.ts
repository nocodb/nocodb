import { Injectable } from '@nestjs/common';
import { SortsService as SortsServiceCE } from 'src/services/sorts.service';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { View } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';

@Injectable()
export class SortsService extends SortsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: any; sort: SortReqType; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const view = await View.get(context, param.viewId, ncMeta);

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
}
