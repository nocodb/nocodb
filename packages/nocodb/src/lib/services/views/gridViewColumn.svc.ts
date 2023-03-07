import type { GridColumnReqType } from 'nocodb-sdk';
import { validatePayload } from '../../meta/api/helpers';
import GridViewColumn from '../../models/GridViewColumn';
import { T } from 'nc-help';

export async function columnList(param: { gridViewId: string }) {
  return await GridViewColumn.list(param.gridViewId);
}

export async function gridColumnUpdate(param: {
  gridViewColumnId: string;
  grid: GridColumnReqType;
}) {
  validatePayload('swagger.json#/components/schemas/GridColumnReq', param.grid);

  T.emit('evt', { evt_type: 'gridViewColumn:updated' });
  return await GridViewColumn.update(param.gridViewColumnId, param.grid);
}
