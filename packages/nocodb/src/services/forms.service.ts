import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ViewTypes } from 'nocodb-sdk';
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { NcContext, NcRequest } from '~/interface/config';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { FormView, Model, Source, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class FormsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async formViewGet(context: NcContext, param: { formViewId: string }) {
    return await FormView.getWithInfo(context, param.formViewId);
  }

  async formViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      body: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    const model = await Model.get(context, param.tableId, ncMeta);

    if (model.synced) {
      NcError._.prohibitedSyncTableOperation({
        modelName: model.title,
        operation: 'create_form_view',
      });
    }

    const source = await Source.get(context, model.source_id);

    if (source.is_data_readonly) {
      NcError.sourceDataReadOnly(source.alias);
    }

    param.body.title = param.body.title?.trim();
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.body.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.body.title,
        label: 'title',
        base: context.base_id,
        additionalTrace: {
          table: param.tableId,
        },
      });
    }
    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
          param.tableId,
        )
      ).forCreate();
    const { id } = await View.insertMetaOnly(
      context,
      {
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
      },
      ncMeta,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id, ncMeta);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy, ncMeta);
    }

    this.appHooksService.emit(AppEvents.FORM_CREATE, {
      user: param.user,
      view,
      req: param.req,
      owner,
      context,
    });

    await view.getViewWithInfo(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_create',
          payload: view,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return view;
  }

  async formViewUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      form: FormUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/FormUpdateReq',
      param.form,
    );
    const view = await View.get(context, param.formViewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.formViewId);
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const oldFormView = await FormView.get(context, param.formViewId, ncMeta);

    await FormView.update(context, param.formViewId, param.form, ncMeta);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    this.appHooksService.emit(AppEvents.FORM_UPDATE, {
      view: { ...view, ...param.form },
      req: param.req,
      formView: param.form,
      oldFormView: oldFormView,
      context,
      owner,
    });

    await view.getViewWithInfo(context);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: view,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return view;
  }
}
