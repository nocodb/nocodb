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

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id, ncMeta);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );
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

    return view;
  }

  async kanbanViewUpdate(
    context: NcContext,
    param: {
      kanbanViewId: string;
      kanban: KanbanUpdateReqType;
      req: NcRequest;
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

    const oldKanbanView = await KanbanView.get(
      context,
      param.kanbanViewId,
      ncMeta,
    );

    const res = await KanbanView.update(
      context,
      param.kanbanViewId,
      param.kanban,
      ncMeta,
    );
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

    return view;
  }

  async kanbanOptionsReorder(
    context: NcContext,
    param: {
      kanbanViewId: string;
      optionsOrder: string[];
      req: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    const kanbanView = await this.kanbanViewGet(context, param, ncMeta);
    const modelView = await View.get(context, kanbanView.fk_view_id, ncMeta);
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
      },
      ncMeta,
    );
  }
}
