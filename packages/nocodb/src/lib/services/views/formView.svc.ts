import { T } from 'nc-help';
import { ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../../meta/api/helpers';
import { FormView, View } from '../../models';
import type { FormReqType, ViewCreateReqType } from 'nocodb-sdk';

export async function formViewGet(param: { formViewId: string }) {
  const formViewData = await FormView.getWithInfo(param.formViewId);
  return formViewData;
}

export async function formViewCreate(param: {
  tableId: string;
  body: ViewCreateReqType;
}) {
  validatePayload('swagger.json#/components/schemas/ViewCreateReq', param.body);

  const view = await View.insert({
    ...param.body,
    // todo: sanitize
    fk_model_id: param.tableId,
    type: ViewTypes.FORM,
  });

  T.emit('evt', { evt_type: 'vtable:created', show_as: 'form' });

  return view;
}

// @ts-ignore
export async function formViewUpdate(param: {
  formViewId: string;
  body: FormReqType;
}) {
  validatePayload('swagger.json#/components/schemas/FormReq', param.body);

  T.emit('evt', { evt_type: 'view:updated', type: 'grid' });
  return await FormView.update(param.formViewId, param.body);
}
