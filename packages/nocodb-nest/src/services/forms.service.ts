import { Injectable } from '@nestjs/common';

import { T } from 'nc-help';
import { ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { FormView, View } from '../models';
import type { FormUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';

@Injectable()
export class FormsService {
  async formViewGet(param: { formViewId: string }) {
    const formViewData = await FormView.getWithInfo(param.formViewId);
    return formViewData;
  }

  async formViewCreate(param: { tableId: string; body: ViewCreateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    const view = await View.insert({
      ...param.body,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.FORM,
    });

    T.emit('evt', { evt_type: 'vtable:created', show_as: 'form' });

    return view;
  }

  async formViewUpdate(param: { formViewId: string; form: FormUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/FormUpdateReq',
      param.form,
    );

    T.emit('evt', { evt_type: 'view:updated', type: 'form' });
    return await FormView.update(param.formViewId, param.form);
  }
}
