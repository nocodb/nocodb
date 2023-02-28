import { KanbanReqType, ViewTypes } from 'nocodb-sdk';
import { KanbanView, View } from '../models';
import { Tele } from 'nc-help';

export async function kanbanViewGet(param: { kanbanViewId: string }) {
  return await KanbanView.get(param.kanbanViewId);
}

export async function kanbanViewCreate(param: {
  tableId: string;
  kanban: KanbanReqType;
}) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'kanban' });
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
  Tele.emit('evt', { evt_type: 'view:updated', type: 'kanban' });
  return await KanbanView.update(param.kanbanViewId, param.kanban);
}
