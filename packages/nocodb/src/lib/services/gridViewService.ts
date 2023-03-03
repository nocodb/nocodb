import { T } from 'nc-help';
import { GridReqType, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../meta/api/helpers';
import { View } from '../models';
import { GridView } from '../models';

export async function gridViewCreate(param: {
  tableId: string;
  grid: GridReqType;
}) {
  validatePayload('swagger.json#/components/schemas/GridReq', param.grid);

  const view = await View.insert({
    ...param.grid,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.GRID,
  });
  T.emit('evt', { evt_type: 'vtable:created', show_as: 'grid' });
  return view;
}

// todo: json schema validation
export async function gridViewUpdate(param: {
  viewId: string;
  grid: GridReqType;
}) {
  T.emit('evt', { evt_type: 'view:updated', type: 'grid' });
  return await GridView.update(param.viewId, param.grid);
}
