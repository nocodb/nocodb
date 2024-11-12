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
import { KanbanView, Model, View } from '~/models';
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

    const { id } = await View.insertMetaOnly(
      context,
      {
        ...param.kanban,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.KANBAN,
        base_id: model.base_id,
        source_id: model.source_id,
        owned_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'kanban',
      user: param.user,

      req: param.req,
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

    const res = await KanbanView.update(
      context,
      param.kanbanViewId,
      param.kanban,
    );

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'kanban',
      req: param.req,
    });

    return res;
  }
}
