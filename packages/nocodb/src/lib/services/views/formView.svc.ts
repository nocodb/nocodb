import { T } from 'nc-help';
import type { FormReqType } from 'nocodb-sdk';
import { ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../../meta/api/helpers';
import { FormView, View } from '../../models';

export async function formViewGet(param: { formViewId: string }) {
  const formViewData = await FormView.getWithInfo(param.formViewId);
  return formViewData;
}

export async function formViewCreate(param: {
  tableId: string;
  body: FormReqType;
}) {
  validatePayload('swagger.json#/components/schemas/FormReq', param.body);

  T.emit('evt', { evt_type: 'vtable:created', show_as: 'form' });
  const view = await View.insert({
    ...param.body,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.FORM,
  });
  return view;
}

// @ts-ignore
export async function formViewUpdate(param: {
  formViewId: string;
  body: FormReqType;
}) {
  validatePayload('swagger.json#/components/schemas/FormReq', param.body);

  T.emit('evt', { evt_type: 'view:updated', type: 'grid' });
  await FormView.update(param.formViewId, param.body);
}
