import { Injectable } from '@nestjs/common';
import { SortsService as SortsServiceCE } from 'src/services/sorts.service';
import type { SortReqType } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { View } from '~/models';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

@Injectable()
export class SortsService extends SortsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async sortCreate(param: { viewId: any; sort: SortReqType; req: any }) {
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const view = await View.get(param.viewId);

    if (!view) {
      NcError.notFound('View not found');
    }

    const workspaceId = await getWorkspaceForBase(view.base_id);

    const sortsInView = await Noco.ncMeta.metaCount(
      null,
      null,
      MetaTable.SORT,
      {
        condition: {
          fk_view_id: view.id,
        },
      },
    );

    const sortLimitForWorkspace = await getLimit(
      PlanLimitTypes.SORT_LIMIT,
      workspaceId,
    );

    if (sortsInView >= sortLimitForWorkspace) {
      NcError.badRequest(
        `Only ${sortLimitForWorkspace} sorts are allowed, for more please upgrade your plan`,
      );
    }

    return super.sortCreate(param);
  }
}
