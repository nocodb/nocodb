import { T } from 'nc-help';
import { validatePayload } from '../meta/api/helpers';
import { View } from '../models';
import type { ViewColumnReqType } from 'nocodb-sdk';

export async function columnList(param: { viewId: string }) {
  return await View.getColumns(param.viewId);
}
export async function columnAdd(param: {
  viewId: string;
  columnId: string;
  column: ViewColumnReqType;
}) {
  validatePayload(
    'swagger.json#/components/schemas/ViewColumnReq',
    param.column
  );

  const viewColumn = await View.insertOrUpdateColumn(
    param.viewId,
    param.columnId,
    param.column
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
