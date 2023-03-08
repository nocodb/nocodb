import { T } from 'nc-help';
import { validatePayload } from '../../meta/api/helpers';
import { FormViewColumn } from '../../models';
export async function columnUpdate(param: {
  formViewColumnId: string;
  // todo: replace with FormColumnReq
  formViewColumn: FormViewColumn;
}) {
  validatePayload(
    'swagger.json#/components/schemas/FormColumnReq',
    param.formViewColumn
  );

  T.emit('evt', { evt_type: 'formViewColumn:updated' });
  return await FormViewColumn.update(
    param.formViewColumnId,
    param.formViewColumn
  );
}
