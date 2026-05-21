import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  ButtonActionsType,
  EventType,
  PlanFeatureTypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
import { NcError } from '~/helpers/catchError';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { generateFormEditToken } from '~/helpers/formEditToken';
import { ButtonColumn, FormView, Model, Source, User, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class FormsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async formViewGet(context: NcContext, param: { formViewId: string }) {
    return await FormView.getWithInfo(context, param.formViewId);
  }

  @TraceCommand(OperationName.formViewCreate)
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
    if (param?.ownedBy) {
      await assertNotSandbox(
        context,
        'Personal views cannot be created in a sandbox. Create them on the production base.',
      );
    }

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.body,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, param.body.lock_type);

    const model = await Model.get(context, param.tableId, false, ncMeta);

    if (model.synced) {
      NcError._.prohibitedSyncTableOperation({
        modelName: model.title,
        operation: 'create_form_view',
      });
    }

    const source = await Source.get(context, model.source_id);

    if (source.is_data_readonly) {
      NcError.get(context).sourceDataReadOnly(source.alias);
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
    const view = await View.get(context, id, false, ncMeta);
    await NocoCache.appendToList(
      context,
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

  @TraceCommand(OperationName.formViewUpdate)
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
    const view = await View.get(context, param.formViewId, false, ncMeta);

    if (!view) {
      NcError.get(context).viewNotFound(param.formViewId);
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

    // Strip the stored bcrypt password hash from every outbound payload.
    const safeView = View.maskPasswordForResponse(view);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: safeView,
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
    return safeView;
  }

  /**
   * Authenticated (base-scoped) counterpart to
   * `PublicDatasService.generatePublicFormEditToken`. Both mint the same
   * HMAC-signed token; this one is reached via the internal `postOperation`
   * endpoint (ACL: `formEditTokenGenerate`, EDITOR role), while the public
   * variant is reached anonymously from a shared grid view.
   *
   * The two code paths exist because the authenticated path can trust the
   * caller's workspace context and column ACLs, while the public path has
   * to re-derive the workspace from the shared view uuid and verify the
   * row is visible through that shared view.
   */
  async generateEditToken(
    context: NcContext,
    param: {
      columnId: string;
      rowId: string;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_OPEN_FORM_BUTTON);

    const buttonCol = await ButtonColumn.read(context, param.columnId);

    if (!buttonCol || buttonCol.type !== ButtonActionsType.OpenForm) {
      NcError.get(context).badRequest('Column is not an OpenForm button');
    }

    const formViewId = buttonCol.fk_form_view_id;

    if (!formViewId) {
      NcError.get(context).badRequest(
        'No form view configured for this button',
      );
    }

    const view = await View.get(context, formViewId);

    if (!view) {
      NcError.get(context).viewNotFound(formViewId);
    }

    if (!view.uuid) {
      NcError.get(context).badRequest(
        'The form linked to this button must be shared publicly. Share the form view and try again.',
      );
    }

    const token = generateFormEditToken(param.rowId, param.columnId, view.uuid);

    return { token, viewUuid: view.uuid, isShared: true };
  }
}
