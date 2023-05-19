import { Injectable } from '@nestjs/common';

import { T } from 'nc-help';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { FormView, View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { FormUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';

@Injectable()
export class FormsService {
  constructor(private readonly appHooksService: AppHooksService) {}

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

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'form',
    });

    return view;
  }

  async formViewUpdate(param: { formViewId: string; form: FormUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/FormUpdateReq',
      param.form,
    );
    const view = await View.get(param.formViewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await FormView.update(param.formViewId, param.form);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'form',
    });

    return res;
  }
}
