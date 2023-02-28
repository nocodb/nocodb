import { FormViewColumn } from '../models';
import { Tele } from 'nc-help';
export async function columnUpdate(param: {
  formViewColumnId: string;
  // todo: replace with FormColumnReq
  formViewColumn: FormViewColumn;
}) {
  Tele.emit('evt', { evt_type: 'formViewColumn:updated' });
  return await FormViewColumn.update(
    param.formViewColumnId,
    param.formViewColumn
  );
}
