import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { FormView, Model, Source, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class FormsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async formViewGet(context: NcContext, param: { formViewId: string }) {
    const formViewData = await FormView.getWithInfo(context, param.formViewId);
    return formViewData;
  }

  async formViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      body: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    const model = await Model.get(context, param.tableId);

    const source = await Source.get(context, model.source_id);

    if (source.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.body,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.FORM,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.FORM_CREATE, {
      user: param.user,
      view,
      req: param.req,
      owner,
      context,
    });

    return view;
  }

  async formViewUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      form: FormUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/FormUpdateReq',
      param.form,
    );
    const view = await View.get(context, param.formViewId);

    if (!view) {
      NcError.viewNotFound(param.formViewId);
    }

    const oldFormView = await FormView.get(context, param.formViewId);

    const res = await FormView.update(context, param.formViewId, param.form);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.FORM_UPDATE, {
      view: { ...view, ...param.form },
      req: param.req,
      formView: param.form,
      oldFormView: oldFormView,
      context,
      owner,
    });

    return res;
  }
}
