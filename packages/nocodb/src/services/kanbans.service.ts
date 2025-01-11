import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  KanbanUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { KanbanView, Model, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class KanbansService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async kanbanViewGet(context: NcContext, param: { kanbanViewId: string }) {
    return await KanbanView.get(context, param.kanbanViewId);
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
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    const model = await Model.get(context, param.tableId);

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.kanban,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.KANBAN,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );
    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
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

    return view;
  }

  async kanbanViewUpdate(
    context: NcContext,
    param: {
      kanbanViewId: string;
      kanban: KanbanUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/KanbanUpdateReq',
      param.kanban,
    );

    const view = await View.get(context, param.kanbanViewId);

    if (!view) {
      NcError.viewNotFound(param.kanbanViewId);
    }

    const oldKanbanView = await KanbanView.get(context, param.kanbanViewId);

    const res = await KanbanView.update(
      context,
      param.kanbanViewId,
      param.kanban,
    );
    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    const kanbanView = await KanbanView.get(context, param.kanbanViewId);

    this.appHooksService.emit(AppEvents.KANBAN_UPDATE, {
      view: view,
      oldKanbanView,
      kanbanView: kanbanView,
      req: param.req,
      owner,
      context,
    });

    return res;
  }
}
