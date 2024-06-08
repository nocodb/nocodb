import { Injectable } from '@nestjs/common';
import { SortsService as SortsServiceCE } from 'src/services/sorts.service';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { View } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

@Injectable()
export class SortsService extends SortsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: any; sort: SortReqType; req: NcRequest },
  ) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const view = await View.get(context, param.viewId);

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

    const sortLimitForWorkspace = await getLimit(
      PlanLimitTypes.SORT_LIMIT,
      context.workspace_id,
    );

    if (sortsInView >= sortLimitForWorkspace) {
      NcError.badRequest(
        `Only ${sortLimitForWorkspace} sorts are allowed, for more please upgrade your plan`,
      );
    }

    return super.sortCreate(context, param);
  }
}
