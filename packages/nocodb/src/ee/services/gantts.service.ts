import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, PlanFeatureTypes, ViewTypes } from 'nocodb-sdk';
import type {
  DateDependencyReqType,
  GanttUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { DateDependencyService } from '~/services/date-dependency.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { Model, User, View } from '~/models';
import GanttView from '~/models/GanttView';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';

@Injectable()
export class GanttsService {
  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly dateDependencyService: DateDependencyService,
  ) {}

  @TraceCommand(OperationName.ganttViewCreate)
  async ganttViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      gantt: ViewCreateReqType;
      // Optional per-view DateDependency rule. When provided, the view is
      // created together with a date-dependency rule scoped to it (fk_gantt_view_id),
      // letting multiple Gantt views on the same table have independent
      // schedules. When omitted, the view falls back to the table-level
      // default rule (fk_gantt_view_id IS NULL) — same as the previous
      // tightly-coupled design.
      dependency?: DateDependencyReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_GANTT_VIEW);

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gantt,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, param.gantt.lock_type);

    const model = await Model.get(context, param.tableId, false, ncMeta);

    param.gantt.title = param.gantt.title?.trim();
    const existingView = await View.getByTitleOrId(
      context,
      {
        titleOrId: param.gantt.title,
        fk_model_id: param.tableId,
      },
      ncMeta,
    );
    if (existingView) {
      NcError.get(context).duplicateAlias({
        type: 'view',
        alias: param.gantt.title,
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
          ...param.gantt,
          fk_model_id: param.tableId,
          type: ViewTypes.GANTT,
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

    const view = await View.get(context, id, false, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    // Create the per-view DateDependency rule (Airtable-style: each Gantt
    // owns its own start / end / dep field selection + cascade behavior).
    // Falls back to the table-level default rule when `dependency` is omitted.
    if (param.dependency) {
      await this.dateDependencyService.update(context, {
        modelId: param.tableId,
        ganttViewId: view.id,
        body: param.dependency,
        req: param.req,
      });
    }

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.GANTT_CREATE, {
      view: {
        ...view,
        ...param.gantt,
      },
      req: param.req,
      context,
      owner,
    });

    await view.getView(context);

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

  @TraceCommand(OperationName.ganttViewUpdate)
  async ganttViewUpdate(
    context: NcContext,
    param: {
      ganttViewId: string;
      gantt: GanttUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    const view = await View.get(context, param.ganttViewId, false, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.ganttViewId);
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

    const oldGanttView = await GanttView.get(
      context,
      param.ganttViewId,
      ncMeta,
    );
    await GanttView.update(
      context,
      param.ganttViewId,
      param.gantt,
      ncMeta,
    );

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by, ncMeta);
    }

    this.appHooksService.emit(AppEvents.GANTT_UPDATE, {
      view: {
        ...view,
        ...param.gantt,
      },
      ganttView: param.gantt,
      oldGanttView,
      req: param.req,
      context,
      owner,
    });

    await view.getView(context);

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
