import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  getKanbanStackType,
  isKanbanJunctionLink,
  isKanbanSummaryFnValid,
  isLinksOrLTAR,
  KANBAN_SUMMARY_COUNT,
  KanbanStackType,
  kanbanSummaryFromView,
  kanbanSummarySupportsColors,
  kanbanSummaryToView,
  parseProp,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  KanbanUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { SelectOption } from '~/models';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { assertNotLaneInstance } from '~/helpers/environmentGuards';
import { NcError } from '~/helpers/catchError';
import { assertViewConfigEditable } from '~/helpers/viewLockHelpers';
import { claimObjectTitle } from '~/helpers/customObjects';
import { normalizeViewTitle } from '~/helpers/viewTitleHelpers';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import {
  BaseUser,
  Column,
  KanbanView,
  Model,
  Source,
  User,
  View,
} from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import { viewForBroadcast } from '~/helpers/publicViewSecrets';

@Injectable()
export class KanbansService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async kanbanViewGet(
    context: NcContext,
    param: { kanbanViewId: string },
    ncMeta?: MetaService,
  ) {
    return await KanbanView.get(context, param.kanbanViewId, ncMeta);
  }

  @TraceCommand(OperationName.kanbanViewCreate)
  async kanbanViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      kanban: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (param?.ownedBy) {
      await assertNotLaneInstance(
        context,
        'Personal views cannot be created in an environment instance. Create them on the production base.',
      );
    }

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, param.kanban.lock_type);

    const model = await Model.get(context, param.tableId, false, ncMeta);

    await this.assertStackFieldSupported(
      context,
      model,
      param.kanban.fk_grp_col_id,
      ncMeta,
    );

    let fk_cover_image_col_id =
      (param.kanban as KanbanView).fk_cover_image_col_id ?? null;

    // if attachment field not mapped(undefined) and at-least one attachment field exists in the model
    // map the first attachment field, skip if duplicating
    // Skip if copy_from_id is present(which means duplicating)
    if (
      (param.kanban as KanbanView).fk_cover_image_col_id === undefined &&
      !(param.kanban as { copy_from_id: string }).copy_from_id
    ) {
      const attachmentField = (await model.getColumns(ncMeta)).find(
        (column) => column.uidt === UITypes.Attachment,
      );
      if (attachmentField) {
        fk_cover_image_col_id = attachmentField.id;
      }
    }

    param.kanban.title = normalizeViewTitle(context, param.kanban.title);

    param.kanban.title = await claimObjectTitle(
      context,
      'view',
      param.kanban.title,
      {
        baseId: model.base_id,
        insideTable: model.table_name,
        ncMeta,
      },
    );
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.kanban.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.kanban.title,
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

    const { id } = await View.insertMetaOnly(
      context,
      {
        view: {
          ...param.kanban,
          // todo: sanitize
          fk_model_id: param.tableId,
          type: ViewTypes.KANBAN,
          base_id: model.base_id,
          source_id: model.source_id,
          created_by: param.user?.id,
          owned_by: param.ownedBy || param.user?.id,
          fk_cover_image_col_id,
        },
        model,
        req: param.req,
      },
      ncMeta,
    );

    const view = await View.get(context, id, false, ncMeta);
    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    await this.initializeKanbanMetaForGroupingColumn(context, view, ncMeta);

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy, ncMeta);
    }

    this.appHooksService.emit(AppEvents.KANBAN_CREATE, {
      view: {
        ...view,
        ...param.kanban,
      },
      user: param.user,
      req: param.req,
      owner,
      context,
    });

    await view.getView<ViewTypes.KANBAN>();

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_create',
          payload: viewForBroadcast(view),
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return view;
  }

  @TraceCommand(OperationName.kanbanViewUpdate)
  async kanbanViewUpdate(
    context: NcContext,
    param: {
      kanbanViewId: string;
      kanban: KanbanUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/KanbanUpdateReq',
      param.kanban,
    );

    const view = await View.get(context, param.kanbanViewId, false, ncMeta);

    if (!view) {
      NcError.get(context).viewNotFound(param.kanbanViewId);
    }
    assertViewConfigEditable(context, view, param.req);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const oldKanbanView = await KanbanView.get(
      context,
      param.kanbanViewId,
      ncMeta,
    );

    const groupingColumnChanged =
      oldKanbanView.fk_grp_col_id !== param.kanban.fk_grp_col_id;

    if (groupingColumnChanged) {
      await this.assertStackFieldSupported(
        context,
        await Model.get(context, view.fk_model_id, false, ncMeta),
        param.kanban.fk_grp_col_id,
        ncMeta,
      );
    }

    // Any summary field in the patch: validate it merged over the saved one.
    const summaryKeys = [
      'summary_fn',
      'fk_summary_col_id',
      'summary_label',
      'summary_colors',
    ] as const;
    const kanbanUpdate = summaryKeys.some((key) => key in param.kanban)
      ? {
          ...param.kanban,
          ...(await this.validateStackSummary(
            context,
            view.fk_model_id,
            {
              summary_fn: oldKanbanView.summary_fn,
              fk_summary_col_id: oldKanbanView.fk_summary_col_id,
              summary_label: oldKanbanView.summary_label,
              summary_colors: oldKanbanView.summary_colors,
              ...param.kanban,
            },
            ncMeta,
          )),
        }
      : param.kanban;

    await KanbanView.update(context, param.kanbanViewId, kanbanUpdate, ncMeta);

    if (groupingColumnChanged) {
      const updatedView = await View.get(
        context,
        param.kanbanViewId,
        false,
        ncMeta,
      );
      await this.initializeKanbanMetaForGroupingColumn(
        context,
        updatedView,
        ncMeta,
      );
    }

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    const kanbanView = await KanbanView.get(
      context,
      param.kanbanViewId,
      ncMeta,
    );

    this.appHooksService.emit(AppEvents.KANBAN_UPDATE, {
      view: view,
      oldKanbanView,
      kanbanView: kanbanView,
      req: param.req,
      owner,
      context,
    });

    await view.getView<ViewTypes.KANBAN>(ncMeta);

    // Strip the stored bcrypt password hash from every outbound payload.
    const safeView = View.maskPasswordForResponse(view);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: viewForBroadcast(safeView),
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return safeView;
  }

  // Summary fields always change together; an unset function clears them all.
  private async validateStackSummary(
    context: NcContext,
    modelId: string,
    body: KanbanUpdateReqType,
    ncMeta?: MetaService,
  ) {
    const summary = kanbanSummaryFromView(body);
    if (!summary) return kanbanSummaryToView(null);

    let column: Column | undefined;
    if (summary.fn !== KANBAN_SUMMARY_COUNT) {
      if (!summary.fk_column_id) {
        NcError.get(context).invalidRequestBody(
          'Summary calculation field is required',
        );
      }
      column = await Column.get(
        context,
        { colId: summary.fk_column_id },
        ncMeta,
      );
      if (!column || column.fk_model_id !== modelId) {
        NcError.get(context).fieldNotFound(summary.fk_column_id);
      }
      column.colOptions = await column.getColOptions(ncMeta);
    }

    if (!isKanbanSummaryFnValid(summary.fn, column)) {
      NcError.get(context).invalidRequestBody(
        `Summary function '${summary.fn}' is not supported for this field`,
      );
    }

    return kanbanSummaryToView({
      ...summary,
      colors: kanbanSummarySupportsColors(summary.fn, column)
        ? summary.colors
        : null,
    });
  }

  /** The stacking field must be one a kanban can stack by; a junction link only on Postgres. */
  private async assertStackFieldSupported(
    context: NcContext,
    model: Model,
    columnId?: string | null,
    ncMeta?: MetaService,
  ) {
    const error = await this.getStackFieldError(
      context,
      model,
      columnId,
      ncMeta,
    );
    if (error) NcError.get(context).badRequest(error);
  }

  /** Why a kanban can't stack by this field, or null when it can (or no field is set). */
  async getStackFieldError(
    context: NcContext,
    model: Model,
    columnId?: string | null,
    ncMeta?: MetaService,
  ): Promise<string | null> {
    if (!columnId || !model) return null;

    const column = (await model.getColumns(ncMeta)).find(
      (col) => col.id === columnId,
    );
    if (!column) NcError.get(context).fieldNotFound(columnId);

    const stackColumn = isLinksOrLTAR(column)
      ? { ...column, colOptions: await column.getColOptions(ncMeta) }
      : column;

    if (isKanbanJunctionLink(stackColumn)) {
      const source = await Source.get(context, model.source_id, false, ncMeta);
      return source?.type === 'pg'
        ? null
        : 'A kanban can stack by a many-to-one link only on a Postgres data source';
    }

    return getKanbanStackType(stackColumn)
      ? null
      : `A kanban can't stack by "${column.title}": use a single select, a single User field or a many-to-one / belongs-to link`;
  }

  /**
   * Initialize or update kanban meta for the grouping column
   */
  private async initializeKanbanMetaForGroupingColumn(
    context: NcContext,
    view: View,
    ncMeta?: MetaService,
  ) {
    const kanbanView = await KanbanView.get(context, view.id, ncMeta);

    if (!kanbanView.fk_grp_col_id) {
      return; // No grouping column set
    }

    const model = await Model.get(context, view.fk_model_id, false, ncMeta);
    const column = (await model.getColumns(ncMeta)).find(
      (col) => col.id === kanbanView.fk_grp_col_id,
    );

    if (!column) return;

    const colOptions = await column.getColOptions(ncMeta);
    const stackType = getKanbanStackType(
      { ...column, colOptions },
      { junctionLinks: true },
    );
    if (!stackType) return;

    // Update groupingFieldColumn in view meta (shared views read it from there)
    const viewMeta = parseProp(view?.meta) || {};
    await View.update(
      context,
      view.id,
      {
        ...view,
        meta: {
          ...viewMeta,
          groupingFieldColumn:
            stackType === KanbanStackType.Link
              ? { ...column, colOptions }
              : column,
        },
      },
      false,
      ncMeta,
    );

    // Stacks by user or linked record are derived from members/records, not stored options
    if (stackType !== KanbanStackType.SingleSelect) return;

    // Update kanban stack meta
    if (colOptions?.options) {
      const stackMetaObj = parseProp(kanbanView.meta) || {};

      if (!stackMetaObj[column.id]) {
        stackMetaObj[column.id] = [];
      }

      // Build new stack meta based on column options
      const newStackMeta = [];
      const existingStacks = stackMetaObj[column.id] || [];

      // Add uncategorized stack first (preserve its existing order if it exists)
      const existingUncategorized = existingStacks.find(
        (stack) => stack.id === 'uncategorized',
      );
      const uncategorizedStack = existingUncategorized || {
        id: 'uncategorized',
        title: null,
        order: 0,
        color: '#6A7184',
        collapsed: false,
      };
      newStackMeta.push(uncategorizedStack);

      // Process each column option, preserving existing order when possible
      let currentMaxOrder = Math.max(
        ...existingStacks.map((s) => s.order || 0),
        0,
      );

      for (const option of colOptions.options) {
        const existingStack = existingStacks.find(
          (stack) => stack.id === option.id,
        );

        if (existingStack) {
          // Update existing stack with new option data but preserve order and collapsed state
          newStackMeta.push({
            ...option,
            order: existingStack.order, // Preserve existing order
            collapsed: existingStack.collapsed || false,
          });
        } else {
          // Add new stack for new option - assign next available order
          currentMaxOrder += 1; // Increment for each new item
          newStackMeta.push({
            ...option,
            order: currentMaxOrder,
            collapsed: false,
          });
        }
      }

      // Sort by preserved/assigned order
      newStackMeta.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Update kanban view meta
      stackMetaObj[column.id] = newStackMeta;
      await KanbanView.update(
        context,
        kanbanView.fk_view_id,
        {
          meta: stackMetaObj,
        },
        ncMeta,
      );
    }
  }

  /**
   * User stack keys are user ids: accepts a base member's id or email, and the id of a removed
   * user that is already in `savedIds` (what a v3 read returns). Rejects anything else.
   */
  private async resolveUserStackKeys(
    context: NcContext,
    baseId: string,
    keys: string[],
    savedIds: Set<string>,
    ncMeta?: MetaService,
  ) {
    if (!keys.length) return keys;

    const users = await BaseUser.getUsersList(
      context,
      { base_id: baseId, include_ws_deleted: true },
      ncMeta,
    );
    const unknown: string[] = [];
    const ids: string[] = [];
    for (const key of keys) {
      const user = users.find(
        (u) => u.id === key || u.email?.toLowerCase() === key?.toLowerCase(),
      );
      if (user) ids.push(user.id);
      else if (savedIds.has(key)) ids.push(key);
      else unknown.push(key);
    }
    if (unknown.length) {
      NcError.get(context).invalidRequestBody(
        `stack_order: '${unknown.join("', '")}' is not a member of this base`,
      );
    }
    return ids;
  }

  async kanbanOptionsReorder(
    context: NcContext,
    param: {
      kanbanViewId: string;
      optionsOrder: string[];
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    const kanbanView = await this.kanbanViewGet(context, param, ncMeta);
    const modelView = await View.get(
      context,
      kanbanView.fk_view_id,
      false,
      ncMeta,
    );

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            modelView.fk_model_id,
          )
        ).withViewId(modelView.id)
      ).forUpdate();

    const model = await Model.get(
      context,
      modelView.fk_model_id,
      false,
      ncMeta,
    );
    const column = (await model.getColumns(ncMeta)).find(
      (col) => col.id === kanbanView.fk_grp_col_id,
    );
    if (!column) {
      NcError.get(context).fieldNotFound(kanbanView.fk_grp_col_id);
    }
    const colOptions = await column.getColOptions(ncMeta);
    const stackType = getKanbanStackType(
      { ...column, colOptions },
      { junctionLinks: true },
    );
    const metaOptions: any[] = parseProp(kanbanView.meta)?.[column.id] ?? [];
    if (stackType === KanbanStackType.User) {
      param.optionsOrder = await this.resolveUserStackKeys(
        context,
        model.base_id,
        param.optionsOrder,
        new Set(metaOptions.map((o) => o.id)),
        ncMeta,
      );
    }
    // User / link stacks are keyed by user id / linked record id, with no stored options
    const options: Pick<SelectOption, 'id' | 'title'>[] =
      stackType === KanbanStackType.SingleSelect
        ? (colOptions?.options as SelectOption[]) ?? []
        : param.optionsOrder.map((key) => ({ id: key, title: key }));
    if (metaOptions.length === 0) {
      metaOptions.push({
        id: 'uncategorized',
        title: null,
        order: 1,
        color: '#6A7184',
        collapsed: false,
      });
    }
    for (const option of options) {
      if (!metaOptions.some((k) => k.id === option.id)) {
        metaOptions.push({
          ...option,
          order: metaOptions.length,
          collapsed: false,
        });
      }
    }
    let maxOrder = 1;
    const optionsOrderMap = param.optionsOrder.reduce((acc, val, idx) => {
      acc[val] = idx + 1;
      return acc;
    }, {});

    const unorderedMetaOptions = [];
    for (const metaOption of metaOptions) {
      if (metaOption.id === 'uncategorized') {
        metaOption.order = 1;
      } else if (optionsOrderMap[metaOption.title]) {
        metaOption.order = optionsOrderMap[metaOption.title];
        maxOrder = Math.max(metaOption.order, maxOrder);
      } else {
        unorderedMetaOptions.push(metaOption);
      }
    }
    unorderedMetaOptions.forEach((opt, idx) => {
      opt.order = maxOrder + idx + 1;
    });

    return await this.kanbanViewUpdate(
      context,
      {
        kanbanViewId: param.kanbanViewId,
        kanban: {
          ...kanbanView,
          meta: {
            ...(parseProp(kanbanView.meta) ?? {}),
            [column.id]: metaOptions.sort((a, b) => a.order - b.order),
          },
        },
        req: param.req,
        viewWebhookManager,
      },
      ncMeta,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(modelView.id)).emit();
    }
  }
}
