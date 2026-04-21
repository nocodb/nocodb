import { Injectable } from '@nestjs/common';
import { SortsService as SortsServiceCE } from 'src/services/sorts.service';
import type { SortReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { b } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
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
  @TraceCommand({
    entity: MetaTable.SORT,
    entityId: 'id',
    parentId: 'viewId',
    description: ({ parentEntityTitle }) =>
      `Add sort in ${b(parentEntityTitle)}`,
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      return { parentEntityTitle: view?.title };
    },
    deps: (_p, r) =>
      r?.fk_column_id
        ? [{ entity: MetaTable.COLUMNS, id: r.fk_column_id }]
        : [],
    idField: 'sort',
  })
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
  @TraceCommand({
    entity: MetaTable.SORT,
    entityId: (p) => p?.sortId,
    description: () => 'Edit sort',
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.sort?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
  })
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
    return super.sortUpdate(context, param, ncMeta);
  }

  @EEOnly()
  @TraceCommand({
    entity: MetaTable.SORT,
    entityId: (p) => p?.sortId,
    description: ({ parentEntityTitle }) =>
      parentEntityTitle
        ? `Delete sort in ${b(parentEntityTitle)}`
        : 'Delete sort',
    resolveCtx: async (context, param) => {
      const sort = await Sort.get(context, param?.sortId);
      if (!sort?.fk_view_id) return {};
      const view = await View.get(context, sort.fk_view_id);
      return { parentEntityTitle: view?.title };
    },
  })
  async sortDelete(
    context: NcContext,
    param: {
      sortId: string;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.sortDelete(context, param, ncMeta);
  }
}
