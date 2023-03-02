import { FormViewColumn } from '../models';
import { T } from 'nc-help';
export async function columnUpdate(param: {
  formViewColumnId: string;
  // todo: replace with FormColumnReq
  formViewColumn: FormViewColumn;
}) {
  T.emit('evt', { evt_type: 'formViewColumn:updated' });
  return await FormViewColumn.update(
    param.formViewColumnId,
    param.formViewColumn
  );
}
