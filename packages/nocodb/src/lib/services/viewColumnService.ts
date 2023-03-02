import { T } from 'nc-help';
import { View } from '../models';

export async function columnList(param: { viewId: string }) {
  return await View.getColumns(param.viewId);
}
export async function columnAdd(param: {
  viewId: string;
  columnId: string;
  // todo: add proper type for grid column in swagger
  column: any;
}) {
  const viewColumn = await View.insertOrUpdateColumn(
    param.viewId,
    param.columnId,
    {
      ...param.column,
      view_id: param.viewId,
    }
  );
  T.emit('evt', { evt_type: 'viewColumn:inserted' });

  return viewColumn;
}

export async function columnUpdate(param: {
  viewId: string;
  columnId: string;
  // todo: add proper type for grid column in swagger
  column: any;
}) {
  const result = await View.updateColumn(
    param.viewId,
    param.columnId,
    param.column
  );
  T.emit('evt', { evt_type: 'viewColumn:updated' });
  return result;
}
