import { Injectable } from '@nestjs/common';
import {UserType, ViewTypes} from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { KanbanView, View } from '../models';
import type { KanbanUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import {AppEvents, AppHooksService} from "./app-hooks/app-hooks.service";

@Injectable()
export class KanbansService {

  constructor(private appHooksService: AppHooksService) {
  }

  async kanbanViewGet(param: { kanbanViewId: string }) {
    return await KanbanView.get(param.kanbanViewId);
  }

  async kanbanViewCreate(param: {
    tableId: string;
    kanban: ViewCreateReqType;
     user: UserType
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    const view = await View.insert({
      ...param.kanban,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.KANBAN,
    });

    T.emit('evt', { evt_type: 'vtable:created', show_as: 'kanban' });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      user: param.user,
      view,
    })

    return view;
  }

  async kanbanViewUpdate(param: {
    kanbanViewId: string;
    kanban: KanbanUpdateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/KanbanUpdateReq',
      param.kanban,
    ),
      T.emit('evt', { evt_type: 'view:updated', type: 'kanban' });
    return await KanbanView.update(param.kanbanViewId, param.kanban);
  }
}
