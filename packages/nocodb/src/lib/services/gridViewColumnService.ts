import { GridColumnReqType } from 'nocodb-sdk';
import GridViewColumn from '../models/GridViewColumn';
import { Tele } from 'nc-help';

export async function columnList(param: { gridViewId: string }) {
  return await GridViewColumn.list(param.gridViewId);
}

export async function gridColumnUpdate(param: {
  gridViewColumnId: string;
  grid: GridColumnReqType;
}) {
  Tele.emit('evt', { evt_type: 'gridViewColumn:updated' });
  return await GridViewColumn.update(param.gridViewColumnId, param.grid);
}
