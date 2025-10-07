import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  parseProp,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  KanbanUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { SelectOption } from '~/models';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { KanbanView, Model, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class KanbansService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async kanbanViewGet(
    context: NcContext,
    param: { kanbanViewId: string },
    ncMeta?: MetaService,
  ) {
    return await KanbanView.get(context, param.kanbanViewId, ncMeta);
  }

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
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    const model = await Model.get(context, param.tableId, ncMeta);

    let fk_cover_image_col_id =
      (param.kanban as KanbanView).fk_cover_image_col_id ?? null;

    // if attachment field not mapped(undefined) and at-least one attachment field exists in the model
    // map the first attachment field, skip if duplicating
    // Skip if copy_from_id is present(which means duplicating)
    if (
      (param.kanban as KanbanView).fk_cover_image_col_id === undefined &&
      !(param.kanban as { copy_from_id: string }).copy_from_id
    ) {
      const attachmentField = (await model.getColumns(context, ncMeta)).find(
        (column) => column.uidt === UITypes.Attachment,
      );
      if (attachmentField) {
        fk_cover_image_col_id = attachmentField.id;
      }
    }

    param.kanban.title = param.kanban.title?.trim();
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

    const view = await View.get(context, id, ncMeta);
    await NocoCache.appendToList(
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

    await view.getView<ViewTypes.KANBAN>(context);

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

    const view = await View.get(context, param.kanbanViewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.kanbanViewId);
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

    const oldKanbanView = await KanbanView.get(
      context,
      param.kanbanViewId,
      ncMeta,
    );

    const groupingColumnChanged =
      oldKanbanView.fk_grp_col_id !== param.kanban.fk_grp_col_id;

    await KanbanView.update(context, param.kanbanViewId, param.kanban, ncMeta);

    if (groupingColumnChanged) {
      const updatedView = await View.get(context, param.kanbanViewId, ncMeta);
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

    await view.getView<ViewTypes.KANBAN>(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
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

    const model = await Model.get(context, view.fk_model_id, ncMeta);
    const column = (await model.getColumns(context, ncMeta)).find(
      (col) => col.id === kanbanView.fk_grp_col_id,
    );

    if (!column || column.uidt !== UITypes.SingleSelect) {
      return; // Only handle SingleSelect columns
    }

    // Update groupingFieldColumn in view meta
    const viewMeta = parseProp(view) || {};
    await View.update(context, view.id, {
      ...view,
      meta: {
        ...viewMeta,
        groupingFieldColumn: column,
      },
    });

    // Update kanban stack meta
    const colOptions = await column.getColOptions(context);
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
      await KanbanView.update(context, kanbanView.fk_view_id, {
        meta: stackMetaObj,
      });
    }
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
    const modelView = await View.get(context, kanbanView.fk_view_id, ncMeta);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            modelView.fk_model_id,
          )
        ).withViewId(modelView.id)
      ).forUpdate();

    const model = await Model.get(context, modelView.fk_model_id, ncMeta);
    const column = (await model.getColumns(context, ncMeta)).find(
      (col) => col.id === kanbanView.fk_grp_col_id,
    );
    if (!column) {
      NcError.get(context).fieldNotFound(kanbanView.fk_grp_col_id);
    }
    const options = (await column.getColOptions(context))
      .options as SelectOption[];
    const metaOptions: any[] = parseProp(kanbanView.meta)?.[column.id] ?? [];
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
