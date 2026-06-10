import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  MetaEventType,
  PlanFeatureTypes,
  ViewTypes,
} from 'nocodb-sdk';
import { ViewsService as ViewsServiceCE } from 'src/services/views.service';
import type {
  SharedViewReqType,
  UserType,
  ViewUpdateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { User, View } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import NocoSocket from '~/socket/NocoSocket';
import {
  assertNotSandbox,
  assertNotSandboxProduction,
} from '~/helpers/sandboxGuards';
@Injectable()
export class ViewsService extends ViewsServiceCE {
  constructor(
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
    protected readonly metaDependencyEventHandler: MetaDependencyEventHandler,
  ) {
    super(appHooksServiceEE, metaDependencyEventHandler);
  }

  @TraceCommand(OperationName.viewUpdate)
  async viewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      view: ViewUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
  ) {
    const view = await View.get(context, param.viewId);
    if (view?.lock_type === 'locked' || param.view?.lock_type === 'locked') {
      await assertNotSandboxProduction(
        context,
        'Locked views cannot be created or modified on a base with an active sandbox. Make changes in the sandbox.',
      );
    }
    if (param.view?.allow_sync === true) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_TABLE_SYNC);
    }
    return super.viewUpdate(context, param);
  }

  @TraceCommand(OperationName.viewDelete)
  async viewDelete(
    context: NcContext,
    param: {
      viewId: string;
      skipTrash?: boolean;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    // `req.user` is the source of truth — set by auth middleware for HTTP
    // and by `makeReplayReq` for sandbox replay / undo dispatch.
    const user = param.req?.user;

    const view = await View.get(context, param.viewId, false, ncMeta);
    if (!view) {
      NcError.get(context).genericNotFound('view', param.viewId);
    }

    if (!view.owned_by) {
      await assertNotSandboxProduction(
        context,
        'Collaborative views cannot be deleted from a base with an active sandbox. Delete the view in the sandbox and merge.',
      );
    }

    if (param.skipTrash) {
      return super.viewDelete(context, param, ncMeta);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.viewId,
      resourceType: 'view',
      user,
      req: param.req,
      ncMeta,
    });

    // Match CE: pick the type-specific delete event
    let deleteEvent = AppEvents.GRID_DELETE;
    if (view.type === ViewTypes.FORM) deleteEvent = AppEvents.FORM_DELETE;
    else if (view.type === ViewTypes.CALENDAR)
      deleteEvent = AppEvents.CALENDAR_DELETE;
    else if (view.type === ViewTypes.GALLERY)
      deleteEvent = AppEvents.GALLERY_DELETE;
    else if (view.type === ViewTypes.KANBAN)
      deleteEvent = AppEvents.KANBAN_DELETE;
    else if (view.type === ViewTypes.MAP) deleteEvent = AppEvents.MAP_DELETE;
    else if (view.type === ViewTypes.LIST) deleteEvent = AppEvents.LIST_DELETE;

    let owner = param.req.user;
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksServiceEE.emit(deleteEvent, {
      view,
      user,
      owner,
      req: param.req,
      context,
    });

    await this.metaDependencyEventHandler.handleEvent(context, {
      eventType: MetaEventType.VIEW_DELETED,
      oldEntity: view,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_delete',
          payload: view,
        },
      },
      context.socket_id,
    );

    return true;
  }

  async shareView(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    await assertNotSandbox(
      context,
      'Shared view links cannot be created on a sandbox base. Share the view on the production base.',
    );
    const view = await View.get(context, param.viewId);
    if (view?.lock_type === 'locked') {
      await assertNotSandboxProduction(
        context,
        'Locked views cannot be modified on a base with an active sandbox. Make changes in the sandbox.',
      );
    }
    return super.shareView(context, param);
  }

  async shareViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      sharedView: SharedViewReqType & { custom_url_path?: string };
      user: UserType;
      req: NcRequest;
    },
  ) {
    await assertNotSandbox(
      context,
      'Shared view links cannot be edited on a sandbox base. Manage sharing on the production base.',
    );
    const view = await View.get(context, param.viewId);
    if (view?.lock_type === 'locked') {
      await assertNotSandboxProduction(
        context,
        'Locked views cannot be modified on a base with an active sandbox. Make changes in the sandbox.',
      );
    }
    return super.shareViewUpdate(context, param);
  }

  async shareViewDelete(
    context: NcContext,
    param: { viewId: string; user: UserType; req: NcRequest },
  ) {
    await assertNotSandbox(
      context,
      'Shared view links cannot be removed on a sandbox base. Manage sharing on the production base.',
    );
    const view = await View.get(context, param.viewId);
    if (view?.lock_type === 'locked') {
      await assertNotSandboxProduction(
        context,
        'Locked views cannot be modified on a base with an active sandbox. Make changes in the sandbox.',
      );
    }
    return super.shareViewDelete(context, param);
  }
}
