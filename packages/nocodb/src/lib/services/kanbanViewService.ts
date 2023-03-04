import { KanbanReqType, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../meta/api/helpers';
import { KanbanView, View } from '../models';
import { T } from 'nc-help';

export async function kanbanViewGet(param: { kanbanViewId: string }) {
  return await KanbanView.get(param.kanbanViewId);
}

export async function kanbanViewCreate(param: {
  tableId: string;
  kanban: KanbanReqType;
}) {
  validatePayload('swagger.json#/components/schemas/KanbanReq', param.kanban),
    T.emit('evt', { evt_type: 'vtable:created', show_as: 'kanban' });
  const view = await View.insert({
    ...param.kanban,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.KANBAN,
  });
  return view;
}

export async function kanbanViewUpdate(param: {
  kanbanViewId: string;
  kanban: KanbanReqType;
}) {
  validatePayload(
    'swagger.json#/components/schemas/KanbanUpdateReq',
    param.kanban
  ),
    T.emit('evt', { evt_type: 'view:updated', type: 'kanban' });
  return await KanbanView.update(param.kanbanViewId, param.kanban);
}
