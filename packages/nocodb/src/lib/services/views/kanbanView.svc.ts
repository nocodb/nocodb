import { ViewTypes } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../../meta/api/helpers';
import { KanbanView, View } from '../../models';
import type { KanbanReqType, ViewCreateReqType } from 'nocodb-sdk';

export async function kanbanViewGet(param: { kanbanViewId: string }) {
  return await KanbanView.get(param.kanbanViewId);
}

export async function kanbanViewCreate(param: {
  tableId: string;
  kanban: ViewCreateReqType;
}) {
  validatePayload(
    'swagger.json#/components/schemas/ViewCreateReq',
    param.kanban
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
