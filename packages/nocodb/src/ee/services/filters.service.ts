import { Injectable } from '@nestjs/common';
import { FiltersService as FiltersServiceCE } from 'src/services/filters.service';
import { AppEvents, isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { FilterReqType, UserType, WidgetType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import {
  TraceCommand,
  type TraceCommandDep,
} from '~/decorators/trace-command.decorator';
import { b } from '~/decorators/trace-command-descriptions';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
import { Column, Filter, Model, View } from '~/models';
import RlsPolicy from '~/ee/models/RlsPolicy';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import Widget from '~/models/Widget';
import RowColorCondition from '~/models/RowColorCondition';

@Injectable()
export class FiltersService extends FiltersServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @EEOnly()
  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: 'id',
    parentId: 'viewId',
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`in ${b(parentEntityTitle)}`);
      if (extra?.tableTitle) parts.push(`· ${b(extra.tableTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      const field = param?.filter?.fk_column_id
        ? await Column.get(context, { colId: param.filter.fk_column_id })
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
    idField: 'filter',
  })
  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const filtersInView = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: {
          _and: [
            {
              fk_view_id: {
                eq: view.id,
              },
            },
            {
              is_group: {
                eq: null,
              },
            },
          ],
        },
      },
    );

    const { limit: filterLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_FILTER_PER_VIEW,
      context.workspace_id,
    );

    if (filtersInView >= filterLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${filterLimitForWorkspace} filters are allowed, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: filterLimitForWorkspace,
          current: filtersInView,
        },
      );
    }

    return super.filterCreate(context, param);
  }

  @EEOnly()
  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: (p) => p?.filterId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Edit filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`in ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const filter = await Filter.get(context, param?.filterId);
      if (!filter) return {};
      const view = filter.fk_view_id
        ? await View.get(context, filter.fk_view_id)
        : undefined;
      const colId = param?.filter?.fk_column_id ?? filter.fk_column_id;
      const field = colId ? await Column.get(context, { colId }) : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
  })
  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    return super.filterUpdate(context, param, ncMeta);
  }

  @EEOnly()
  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: (p) => p?.filterId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Delete filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`from ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const filter = await Filter.get(context, param?.filterId);
      if (!filter) return {};
      const view = filter.fk_view_id
        ? await View.get(context, filter.fk_view_id)
        : undefined;
      const field = filter.fk_column_id
        ? await Column.get(context, { colId: filter.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title },
      };
    },
  })
  async filterDelete(
    context: NcContext,
    param: { filterId: string; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    return super.filterDelete(context, param, ncMeta);
  }

  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: 'id',
    parentId: (p) => p?.columnId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`for link ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const linkCol = param?.columnId
        ? await Column.get(context, { colId: param.columnId })
        : undefined;
      const field = param?.filter?.fk_column_id
        ? await Column.get(context, { colId: param.filter.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: linkCol?.title,
        extra: { fieldTitle: field?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      const linkColId = p?.columnId;
      const deps: TraceCommandDep[] = [];
      if (colId) deps.push({ entity: MetaTable.COLUMNS, id: colId });
      if (linkColId) deps.push({ entity: MetaTable.COLUMNS, id: linkColId });
      return deps;
    },
    idField: 'filter',
  })
  async linkFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      columnId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const column = await Column.get(context, { colId: param.columnId });

    // Accept link columns (LTAR/Links) as well as Rollup/Lookup columns —
    // their "limit linked records" filters are also persisted via
    // linkFilterCreate, with fk_link_col_id pointing at the rollup/lookup
    // column itself (the field name is overloaded across these types).
    if (
      !column ||
      (!isLinksOrLTAR(column) &&
        column.uidt !== UITypes.Rollup &&
        column.uidt !== UITypes.Lookup)
    ) {
      NcError.badRequest('Link column not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_link_col_id: param.columnId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      column:
        param.filter.fk_column_id &&
        (await Column.get(context, {
          colId: param.filter.fk_column_id,
        })),
      linkColumn: column,
      req: param.req,
      context,
    });

    return filter;
  }

  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: 'id',
    parentId: (p) => p?.widgetId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`for widget ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const widget = param?.widgetId
        ? ((await Widget.get(context, param.widgetId)) as WidgetType)
        : undefined;
      const field = param?.filter?.fk_column_id
        ? await Column.get(context, { colId: param.filter.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: widget?.title,
        extra: { fieldTitle: field?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
    idField: 'filter',
  })
  async widgetFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      widgetId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const widget = await Widget.get(context, param.widgetId);

    if (!widget) {
      NcError.badRequest('Widget not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_widget_id: param.widgetId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      column:
        param.filter.fk_column_id &&
        (await Column.get(context, {
          colId: param.filter.fk_column_id,
        })),
      widget:
        param.filter.fk_widget_id &&
        ((await Widget.get(context, param.filter.fk_widget_id)) as WidgetType),
      req: param.req,
      context,
    });

    return filter;
  }

  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: 'id',
    parentId: (p) => p?.rlsPolicyId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) {
        parts.push(`for RLS policy ${b(parentEntityTitle)}`);
      } else {
        parts.push('for RLS policy');
      }
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const policy = param?.rlsPolicyId
        ? await RlsPolicy.get(context, param.rlsPolicyId)
        : undefined;
      const field = param?.filter?.fk_column_id
        ? await Column.get(context, { colId: param.filter.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: policy?.title,
        extra: { fieldTitle: field?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
    idField: 'filter',
  })
  async rlsPolicyFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      rlsPolicyId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    await assertNotSandbox(context);

    const policy = await RlsPolicy.get(context, param.rlsPolicyId);

    if (!policy) {
      NcError.badRequest('RLS Policy not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_rls_policy_id: param.rlsPolicyId,
    });

    return filter;
  }

  async rlsPolicyFilterList(
    context: NcContext,
    param: { rlsPolicyId: string },
  ) {
    return Filter.rootFilterListByRlsPolicy(context, {
      rlsPolicyId: param.rlsPolicyId,
    });
  }

  async linkFilterList(context: NcContext, param: { columnId: any }) {
    return Filter.rootFilterListByLink(context, { columnId: param.columnId });
  }

  async widgetFilterList(context: NcContext, param: { widgetId: any }) {
    return Filter.rootFilterListByWidget(context, { widgetId: param.widgetId });
  }

  @TraceCommand({
    entity: MetaTable.FILTER_EXP,
    entityId: 'id',
    parentId: (p) => p?.rowColorConditionsId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add row color filter'];
      if (extra?.fieldTitle) parts.push(`on ${b(extra.fieldTitle)}`);
      if (parentEntityTitle) parts.push(`in ${b(parentEntityTitle)}`);
      return parts.join(' ');
    },
    resolveCtx: async (context, param) => {
      const condition = param?.rowColorConditionsId
        ? await RowColorCondition.getById(context, param.rowColorConditionsId)
        : undefined;
      const view = condition?.fk_view_id
        ? await View.get(context, condition.fk_view_id)
        : undefined;
      const field = param?.filter?.fk_column_id
        ? await Column.get(context, { colId: param.filter.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
    idField: 'filter',
  })
  async rowColorConditionsCreate(
    context: NcContext,
    param: {
      rowColorConditionsId: string;
      filter: FilterReqType;
      viewWebhookManager?: ViewWebhookManager;
      req?: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    const rowColorCondition = await RowColorCondition.getById(
      context,
      param.rowColorConditionsId,
      ncMeta,
    );
    if (!rowColorCondition) {
      NcError.get(context).invalidRequestBody(
        `Condition id ${param.rowColorConditionsId} not found`,
      );
    }
    let innerViewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        false,
        ncMeta,
      );
      innerViewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_row_color_condition_id: param.rowColorConditionsId,
    } as any);

    if (innerViewWebhookManager) {
      (
        await innerViewWebhookManager.withNewViewId(
          innerViewWebhookManager.getViewId(),
        )
      ).emit();
    }

    return filter;
  }
}
