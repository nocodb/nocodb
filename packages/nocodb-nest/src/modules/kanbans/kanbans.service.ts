import { Injectable } from '@nestjs/common';
import { KanbanUpdateReqType, ViewCreateReqType, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { KanbanView, View } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class KanbansService {
  async kanbanViewGet(param: { kanbanViewId: string }) {
    return await KanbanView.get(param.kanbanViewId);
  }

  async kanbanViewCreate(param: {
    tableId: string;
    kanban: ViewCreateReqType;
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
