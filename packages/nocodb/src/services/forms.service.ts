import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { FormView, Model, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class FormsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async formViewGet(param: { formViewId: string }) {
    const formViewData = await FormView.getWithInfo(param.formViewId);
    return formViewData;
  }

  async formViewCreate(param: {
    tableId: string;
    body: ViewCreateReqType;
    user: UserType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    // const view = await View.insert({
    //   ...param.body,
    //   // todo: sanitize
    //   fk_model_id: param.tableId,
    //   type: ViewTypes.FORM,
    // });

    const model = await Model.get(param.tableId);

    const { id } = await View.insertMetaOnly(
      {
        ...param.body,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.FORM,
        base_id: model.base_id,
        source_id: model.source_id,
      },
      model,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      user: param.user,
      view,
      showAs: 'form',
      req: param.req,
    });

    return view;
  }

  async formViewUpdate(param: {
    formViewId: string;
    form: FormUpdateReqType;
    req: NcRequest;
  }) {
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
      req: param.req,
    });

    return res;
  }
}
