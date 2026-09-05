import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, isVirtualCol, UITypes } from 'nocodb-sdk';
import Noco from 'src/Noco';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { assertLookupSortLimitLicensed } from '~/helpers/lookupSortLimitGate';
import { NcError } from '~/helpers/catchError';
import { Column, Sort, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class SortsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async sortGet(context: NcContext, param: { sortId: string }) {
    return Sort.get(context, param.sortId);
  }

  async sortDelete(
    context: NcContext,
    param: {
      sortId: string;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    const sort = await Sort.get(context, param.sortId, ncMeta);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const column = await Column.get(
      context,
      { colId: sort.fk_column_id },
      ncMeta,
    );

    // Lookup-scoped sort (fk_lookup_col_id, no view): no view webhooks/hooks.
    if (!sort.fk_view_id) {
      await Sort.delete(context, param.sortId, ncMeta);
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: { action: 'sort_delete', payload: sort },
        },
        context.socket_id,
      );
      return true;
    }

    const view = await View.get(context, sort.fk_view_id, false, ncMeta);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    await Sort.delete(context, param.sortId, ncMeta);

    this.appHooksService.emit(AppEvents.SORT_DELETE, {
      sort,
      req: param.req,
      view,
      column,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_delete',
          payload: sort,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return true;
  }

  async sortUpdate(
    context: NcContext,
    param: {
      sortId: any;
      sort: SortReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    if (param.sort.fk_column_id) {
      const col = await Column.get(
        context,
        { colId: param.sort.fk_column_id },
        ncMeta,
      );
      if (col?.colOptions?.error) {
        NcError.get(context).badRequest(
          `Cannot use column '${col.title}' in sort: ${col.colOptions.error}`,
        );
      }
    }

    const sort = await Sort.get(context, param.sortId, ncMeta);

    if (!sort) {
      NcError.badRequest('Sort not found');
    }

    const column = await Column.get(
      context,
      { colId: sort.fk_column_id },
      ncMeta,
    );

    // Lookup-scoped sort (fk_lookup_col_id, no view): there is no view to drive
    // view webhooks/hooks, so just persist the change and broadcast.
    if (!sort.fk_view_id) {
      const res = await Sort.update(context, param.sortId, param.sort, ncMeta);
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'sort_update',
            payload: { ...sort, ...param.sort },
          },
        },
        context.socket_id,
      );
      return res;
    }

    const view = await View.get(context, sort.fk_view_id, false, ncMeta);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await Sort.update(context, param.sortId, param.sort, ncMeta);

    this.appHooksService.emit(AppEvents.SORT_UPDATE, {
      sort: {
        ...sort,
        ...param.sort,
      },
      oldSort: sort,
      column,
      view,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_update',
          payload: {
            ...sort,
            ...param.sort,
          },
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return res;
  }

  async sortCreate(
    context: NcContext,
    param: {
      viewId: string;
      sort: SortReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }
    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    if (param.sort.fk_column_id) {
      const col = await Column.get(
        context,
        { colId: param.sort.fk_column_id },
        ncMeta,
      );
      if (col?.colOptions?.error) {
        NcError.get(context).badRequest(
          `Cannot use column '${col.title}' in sort: ${col.colOptions.error}`,
        );
      }
    }

    const view = await View.get(context, param.viewId, false, ncMeta);

    if (!view) {
      NcError.badRequest('View not found');
    }
    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const sort = await Sort.insert(
      context,
      {
        ...param.sort,
        fk_view_id: param.viewId,
      } as Sort,
      ncMeta,
    );

    const column = await Column.get(
      context,
      { colId: sort.fk_column_id },
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.SORT_CREATE, {
      sort,
      view,
      column,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'sort_create',
          payload: sort,
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return sort;
  }

  async sortList(context: NcContext, param: { viewId: string }) {
    return Sort.list(context, { viewId: param.viewId });
  }

  // ── Lookup-scoped sorts (fk_lookup_col_id) — mirror of linkFilterCreate/List ──
  // Order the relation sub-query of a Lookup column. CRUD by sortId for
  // update/delete reuses the existing sortUpdate/sortDelete.
  async lookupSortCreate(
    context: NcContext,
    param: { columnId: string; sort: SortReqType; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    // Per-lookup sort is a paid feature — gate creation behind the license so it
    // can't be written through the raw op on an unlicensed/CE workspace (the
    // column-save path gates the same feature via validateLookupSortConfig).
    await assertLookupSortLimitLicensed(context);

    validatePayload('swagger.json#/components/schemas/SortReq', param.sort);

    const lookupCol = await Column.get(
      context,
      { colId: param.columnId },
      ncMeta,
    );
    if (!lookupCol || lookupCol.uidt !== UITypes.Lookup) {
      NcError.get(context).badRequest('Lookup column not found');
    }

    // The sort column must belong to the lookup's related table — otherwise it
    // silently no-ops at query time. Resolve the related model via the lookup's
    // target column; skip the check only if it can't be resolved.
    if ((param.sort as any)?.fk_column_id) {
      const sortCol = await Column.get(
        context,
        { colId: (param.sort as any).fk_column_id },
        ncMeta,
      );

      // Only real scalar columns are sortable: the correlated sub-query the
      // filter/formula/view-sort consumers build orders by the physical
      // `column_name`, which a virtual column (Formula/Lookup/Rollup/LTAR/…)
      // doesn't have — allowing one would emit an invalid ORDER BY and 500 on
      // every filtered read. Mirrors the UI's disabled-column rule (LookupSort.vue).
      if (sortCol && isVirtualCol(sortCol)) {
        NcError.get(context).badRequest(
          'Lookup sort column must be a sortable (scalar) field',
        );
      }

      let relatedModelId: string | undefined;
      try {
        const colOpt: any = await lookupCol.getColOptions(ncMeta);
        const targetColId = colOpt?.fk_lookup_column_id;
        if (targetColId) {
          const targetCol = await Column.get(
            context,
            { colId: targetColId },
            ncMeta,
          );
          relatedModelId = targetCol?.fk_model_id;
        }
      } catch {
        relatedModelId = undefined;
      }
      if (relatedModelId) {
        if (!sortCol || sortCol.fk_model_id !== relatedModelId) {
          NcError.get(context).badRequest(
            'Lookup sort column must belong to the related table',
          );
        }
      }
    }

    return await Sort.insert(
      context,
      {
        ...param.sort,
        fk_lookup_col_id: param.columnId,
      },
      ncMeta,
    );
  }

  async lookupSortList(
    context: NcContext,
    param: { columnId: string },
    ncMeta?: MetaService,
  ) {
    return await Sort.listByLookupColumn(
      context,
      { columnId: param.columnId },
      ncMeta,
    );
  }
}
