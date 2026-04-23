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
import { Column, Model, Sort, View } from '~/models';
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
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add sort'];
      if (extra?.fieldTitle) parts.push(`by ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`in ${b(parentEntityTitle)}`);
      if (extra?.tableTitle) parts.push(`· ${b(extra.tableTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      const field = param?.sort?.fk_column_id
        ? await Column.get(context, { colId: param.sort.fk_column_id })
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
      };
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
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Edit sort'];
      if (extra?.fieldTitle) parts.push(`by ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`in ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const sort = await Sort.get(context, param?.sortId);
      if (!sort) return {};
      const view = sort.fk_view_id
        ? await View.get(context, sort.fk_view_id)
        : undefined;
      const colId = param?.sort?.fk_column_id ?? sort.fk_column_id;
      const field = colId ? await Column.get(context, { colId }) : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title },
      };
    },
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
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Delete sort'];
      if (extra?.fieldTitle) parts.push(`by ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`from ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const sort = await Sort.get(context, param?.sortId);
      if (!sort) return {};
      const view = sort.fk_view_id
        ? await View.get(context, sort.fk_view_id)
        : undefined;
      const field = sort.fk_column_id
        ? await Column.get(context, { colId: sort.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title },
      };
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
