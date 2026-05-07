import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import type {
  FilterType,
  ListUpdateReqType,
  SortType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  Column,
  Filter,
  ListView,
  ListViewColumn,
  Model,
  Sort,
  Source,
  User,
  View,
} from '~/models';
import ListViewLevel from '~/models/ListViewLevel';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';

@Injectable()
export class ListsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  @TraceCommand(OperationName.listViewCreate)
  async listViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      list: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_LIST_VIEW);

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.list,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, param.list.lock_type);

    const model = await Model.get(context, param.tableId);

    const source = await Source.get(context, model.source_id);
    if (source.type !== 'pg') {
      NcError.get(context).badRequest(
        'List view is only supported for Postgres or Default source',
      );
    }

    param.list.title = param.list.title?.trim();
    const existingView = await View.getByTitleOrId(context, {
      titleOrId: param.list.title,
      fk_model_id: param.tableId,
    });
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.list.title,
        label: 'title',
        base: context.base_id,
        additionalTrace: {
          table: param.tableId,
        },
      });
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
          param.tableId,
        )
      ).forCreate();

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.list,
        fk_model_id: param.tableId,
        type: ViewTypes.LIST,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    const view = await View.get(context, id);
    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.LIST_CREATE, {
      view,
      req: param.req,
      owner,
      context,
    });

    await view.getView(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_create',
          payload: view,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return view;
  }

  @TraceCommand(OperationName.listViewUpdate)
  async listViewUpdate(
    context: NcContext,
    param: {
      listViewId: string;
      list: ListUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ListUpdateReq',
      param.list,
    );

    const view = await View.get(context, param.listViewId);

    if (!view) {
      NcError.get(context).viewNotFound(param.listViewId);
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

    const oldListView = await ListView.get(context, param.listViewId);

    if (param.list.levels) {
      await ListViewLevel.bulkInsertOrUpdate(
        context,
        param.listViewId,
        param.list.levels,
      );
    }

    const { levels: _levels, ...updateData } = param.list;
    await ListView.update(context, param.listViewId, updateData);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.LIST_UPDATE, {
      view,
      listView: param.list,
      oldListView,
      req: param.req,
      context,
      owner,
    });

    await view.getView(context);

    // Strip the stored bcrypt password hash from every outbound payload.
    const safeView = View.maskPasswordForResponse(view);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: safeView,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return safeView;
  }

  // Inverse of `listViewUpdate{levels: ...}`. Delegates to
  // `ListViewLevel.bulkInsertOrUpdate` for the level diff, then replaces
  // each level's list-view-columns, sorts, and filter trees from the
  // snapshot so removed-then-restored levels keep their original ids +
  // width/visibility/order/comparison-op/etc.
  @TraceCommand(OperationName.listViewLevelsRestore)
  async restoreListViewLevels(
    context: NcContext,
    param: {
      viewId: string;
      list?: Partial<ListView>;
      levels: Array<
        Partial<ListViewLevel> & {
          id: string;
          columns?: Array<Partial<ListViewColumn> & { id?: string }>;
          sorts?: Array<Partial<SortType> & { id?: string }>;
          filters?: Array<Partial<FilterType> & { id?: string }>;
        }
      >;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const view = await View.get(context, param.viewId, false, ncMeta);
    if (!view) {
      NcError.get(context).viewNotFound(param.viewId);
    }
    if (view.type !== ViewTypes.LIST) {
      NcError.get(context).badRequest(
        `restoreListViewLevels expected a list view, got type=${view.type}`,
      );
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

    await ListViewLevel.bulkInsertOrUpdate(
      context,
      param.viewId,
      param.levels,
      ncMeta,
    );

    // Replace columns per level from the snapshot. `bulkInsertOrUpdate`
    // auto-creates columns for newly-inserted (= removed-then-restored)
    // levels via `createColumnsForLevel`, but with fresh ids — we wipe
    // those and re-insert from the snapshot so ids + widths + visibility
    // round-trip correctly. `ListViewColumn.insert` honors pre-set ids
    // under `is_replay`.
    for (const lvl of param.levels) {
      if (!lvl.columns) continue;
      const currentCols = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.LIST_VIEW_COLUMNS,
        { condition: { fk_level_id: lvl.id } },
      );
      for (const c of currentCols) {
        await NocoCache.deepDel(
          context,
          `${CacheScope.LIST_VIEW_COLUMN}:${c.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.LIST_VIEW_COLUMNS,
        { fk_level_id: lvl.id },
      );
      const snapshotColumnIds = new Set<string>();
      let maxSnapshotOrder = 0;
      for (const col of lvl.columns) {
        await ListViewColumn.insert(
          context,
          { ...col, fk_level_id: lvl.id, fk_view_id: param.viewId },
          ncMeta,
        );
        const fkCol = (col as { fk_column_id?: string }).fk_column_id;
        if (fkCol) snapshotColumnIds.add(fkCol);
        const ord = (col as { order?: number }).order;
        if (typeof ord === 'number' && ord > maxSnapshotOrder) {
          maxSnapshotOrder = ord;
        }
      }

      if (lvl.fk_model_id) {
        const modelColumns = await Column.list(
          context,
          { fk_model_id: lvl.fk_model_id, includeDeleted: true },
          ncMeta,
        );
        let nextOrder = maxSnapshotOrder + 1;
        for (const mc of modelColumns) {
          if (!mc.id || snapshotColumnIds.has(mc.id)) continue;
          await ListViewColumn.insert(
            context,
            {
              fk_view_id: param.viewId,
              fk_column_id: mc.id,
              fk_level_id: lvl.id,
              show: false,
              order: nextOrder++,
            },
            ncMeta,
          );
        }
      }
    }

    for (const lvl of param.levels) {
      if (!lvl.sorts) continue;
      const currentSorts = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        { condition: { fk_level_id: lvl.id } },
      );
      for (const s of currentSorts) {
        await NocoCache.deepDel(
          context,
          `${CacheScope.SORT}:${s.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        NocoSocket.broadcastEvent(
          context,
          {
            event: EventType.META_EVENT,
            payload: { action: 'sort_delete', payload: s },
          },
          context.socket_id,
        );
      }
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        { fk_level_id: lvl.id },
      );
      for (const sort of lvl.sorts) {
        const inserted = await Sort.insert(
          context,
          { ...sort, fk_level_id: lvl.id, fk_view_id: param.viewId },
          ncMeta,
        );
        NocoSocket.broadcastEvent(
          context,
          {
            event: EventType.META_EVENT,
            payload: { action: 'sort_create', payload: inserted },
          },
          context.socket_id,
        );
      }
    }

    for (const lvl of param.levels) {
      if (!lvl.filters) continue;
      const allViewFilters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        { condition: { fk_view_id: param.viewId } },
      );
      const childrenByParent = new Map<string, typeof allViewFilters>();
      for (const f of allViewFilters) {
        if (!f.fk_parent_id) continue;
        if (!childrenByParent.has(f.fk_parent_id)) {
          childrenByParent.set(f.fk_parent_id, []);
        }
        childrenByParent.get(f.fk_parent_id)!.push(f);
      }
      const idsToDelete = new Set<string>();
      const stack = allViewFilters.filter(
        (f) => (f as { fk_level_id?: string }).fk_level_id === lvl.id,
      );
      while (stack.length) {
        const f = stack.shift()!;
        if (!f.id || idsToDelete.has(f.id)) continue;
        idsToDelete.add(f.id);
        stack.push(...(childrenByParent.get(f.id) ?? []));
      }
      for (const f of lvl.filters) {
        if (f.id) idsToDelete.add(f.id);
      }
      const filtersById = new Map<string, Record<string, unknown>>();
      for (const f of allViewFilters) {
        if (f.id) filtersById.set(f.id, f);
      }
      for (const id of Array.from(idsToDelete)) {
        await NocoCache.deepDel(
          context,
          `${CacheScope.FILTER_EXP}:${id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
        await ncMeta.metaDelete(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          id,
        );
        const original = filtersById.get(id);
        if (original) {
          NocoSocket.broadcastEvent(
            context,
            {
              event: EventType.META_EVENT,
              payload: { action: 'filter_delete', payload: original },
            },
            context.socket_id,
          );
        }
      }

      const snapshotChildrenByParent = new Map<
        string | null,
        Array<Partial<FilterType> & { id?: string }>
      >();
      for (const f of lvl.filters) {
        const key = f.fk_parent_id ?? null;
        if (!snapshotChildrenByParent.has(key)) {
          snapshotChildrenByParent.set(key, []);
        }
        snapshotChildrenByParent.get(key)!.push(f);
      }
      const queue: Array<Partial<FilterType> & { id?: string }> = [
        ...(snapshotChildrenByParent.get(null) ?? []),
      ];
      const inserted = new Set<string>();
      while (queue.length) {
        const f = queue.shift()!;
        if (!f.id || inserted.has(f.id)) continue;
        const { children: _children, ...rest } = f as typeof f & {
          children?: unknown;
        };
        const insertedFilter = await Filter.insert(
          context,
          {
            ...rest,
            fk_view_id: param.viewId,
          },
          ncMeta,
        );
        NocoSocket.broadcastEvent(
          context,
          {
            event: EventType.META_EVENT,
            payload: { action: 'filter_create', payload: insertedFilter },
          },
          context.socket_id,
        );
        inserted.add(f.id);
        queue.push(...(snapshotChildrenByParent.get(f.id) ?? []));
      }
    }

    if (param.list) {
      await ListView.update(context, param.viewId, param.list);
    }

    const refreshedListView = await ListView.get(context, param.viewId, ncMeta);
    let owner = param.req?.user;
    if (view.owned_by && view.owned_by !== param.req?.user?.id) {
      owner = await User.get(view.owned_by);
    }
    this.appHooksService.emit(AppEvents.LIST_UPDATE, {
      view,
      listView: refreshedListView,
      oldListView: refreshedListView,
      req: param.req,
      context,
      owner,
    });

    await view.getView(context, ncMeta);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: { action: 'view_update', payload: view },
      },
      context.socket_id,
    );

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_refresh',
          payload: { fk_view_id: param.viewId },
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
  }
}
