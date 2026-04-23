import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  GanttDependencyDirection,
  PlanFeatureTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  ColumnType,
  GanttRangeType,
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
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { assertPersonalViewAllowed } from '~/helpers/checkPersonalViewFeature';
import { Column, Model, User, View } from '~/models';
import GanttView from '~/models/GanttView';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';

const DATE_LIKE_UITYPES = new Set<UITypes>([
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
]);

async function validateGanttRange(
  context: NcContext,
  tableId: string,
  ranges: GanttRangeType[] | undefined,
  ncMeta?: MetaService,
) {
  if (!ranges?.length) return;

  const columns = await Column.list(context, { fk_model_id: tableId }, ncMeta);
  const byId = new Map<string, ColumnType>(columns.map((c) => [c.id, c]));

  for (const range of ranges) {
    const assertDateCol = (id: string | null | undefined, label: string) => {
      if (!id) return;
      const col = byId.get(id);
      if (!col) {
        NcError.get(context).fieldNotFound(id);
      }
      if (!DATE_LIKE_UITYPES.has(col.uidt as UITypes)) {
        NcError.get(context).invalidRequestBody(
          `${label} must reference a Date or DateTime field`,
        );
      }
    };

    assertDateCol(range.fk_start_col_id, 'Gantt start column');
    assertDateCol(range.fk_end_col_id, 'Gantt end column');

    if (range.fk_dependency_col_id) {
      const depCol = columns.find(
        (c) => c.id === range.fk_dependency_col_id,
      ) as Column | undefined;
      if (!depCol) {
        NcError.get(context).fieldNotFound(range.fk_dependency_col_id);
      }
      if (
        depCol.uidt !== UITypes.Links &&
        depCol.uidt !== UITypes.LinkToAnotherRecord
      ) {
        NcError.get(context).invalidRequestBody(
          'Gantt dependency column must be a Links field',
        );
      }
      const colOpts: any = await depCol.getColOptions(context, ncMeta);
      if (
        colOpts?.fk_related_model_id &&
        colOpts.fk_related_model_id !== tableId
      ) {
        NcError.get(context).invalidRequestBody(
          'Gantt dependency column must link to the same table (self-relation)',
        );
      }
    }

    if (
      range.dependency_direction &&
      !Object.values(GanttDependencyDirection).includes(
        range.dependency_direction,
      )
    ) {
      NcError.get(context).invalidRequestBody(
        `Invalid Gantt dependency_direction: ${range.dependency_direction}`,
      );
    }
  }
}

@Injectable()
export class GanttsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async ganttViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      gantt: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    // await checkForFeature(context, PlanFeatureTypes.FEATURE_GANTT_VIEW);

    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.gantt,
    );

    if (context.schema_locked) {
      NcError.get(context).schemaLocked();
    }

    await assertPersonalViewAllowed(context, param.gantt.lock_type);

    await validateGanttRange(
      context,
      param.tableId,
      (param.gantt as { gantt_range?: GanttRangeType[] }).gantt_range,
      ncMeta,
    );

    const model = await Model.get(context, param.tableId, ncMeta);

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

    const view = await View.get(context, id, ncMeta);

    await NocoCache.appendToList(
      context,
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

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
    const view = await View.get(context, param.ganttViewId, ncMeta);

    if (!view) {
      NcError.viewNotFound(param.ganttViewId);
    }

    await validateGanttRange(
      context,
      view.fk_model_id,
      param.gantt.gantt_range,
      ncMeta,
    );

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
