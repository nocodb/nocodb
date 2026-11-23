import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, ncIsObject, ViewTypes } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/cli';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { assertViewConfigEditable } from '~/helpers/viewLockHelpers';
import { assertNotLockedViewOnLaneProduction } from '~/helpers/environmentGuards';
import { Column, GridViewColumn, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class GridColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnList(
    context: NcContext,
    param: { gridViewId: string },
    ncMeta?: MetaService,
  ) {
    return await GridViewColumn.list(context, param.gridViewId, ncMeta);
  }

  @TraceCommand(OperationName.gridColumnUpdate)
  async gridColumnUpdate(
    context: NcContext,
    param: {
      gridViewColumnId: string;
      grid: GridColumnReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.grid,
    );

    const oldGridViewColumn = await GridViewColumn.get(
      context,
      param.gridViewColumnId,
      ncMeta,
    );

    if (!oldGridViewColumn) {
      NcError.get(context).fieldNotFound(param.gridViewColumnId);
    }

    if (oldGridViewColumn?.fk_view_id) {
      await assertNotLockedViewOnLaneProduction(
        context,
        oldGridViewColumn.fk_view_id,
        undefined,
        ncMeta,
      );
    }

    const column = await Column.get(
      context,
      {
        colId: oldGridViewColumn.fk_column_id,
      },
      ncMeta,
    );

    const view = await View.get(
      context,
      oldGridViewColumn.fk_view_id,
      false,
      ncMeta,
    );
    assertViewConfigEditable(context, view, param.req);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await GridViewColumn.update(
      context,
      param.gridViewColumnId,
      param.grid,
      ncMeta,
    );

    const viewColumn = extractProps(param.grid, [
      'order',
      'show',
      'width',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'group_by_enabled',
      'aggregation',
    ]);

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldGridViewColumn,
      // todo: improve and move it to one place rather than repetition
      viewColumn,
      column,
      view,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_update',
          payload: {
            ...oldGridViewColumn,
            ...viewColumn,
          },
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return res;
  }

  // One request and one undo step for a multi-column resize or "fit all columns"
  @TraceCommand(OperationName.gridColumnsBulkUpdateWidth)
  async gridColumnsBulkUpdateWidth(
    context: NcContext,
    param: {
      viewId: string;
      // grid view-column id (NOT field id) → width, e.g. '240px'
      columnWidths: Record<string, string | null>;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (!ncIsObject(param.columnWidths)) {
      NcError.get(context).invalidRequestBody('columnWidths is required');
    }
    for (const width of Object.values(param.columnWidths)) {
      if (width !== null) {
        validatePayload('swagger.json#/components/schemas/GridColumnReq', {
          width,
        });
      }
    }

    const view = await View.get(context, param.viewId, false, ncMeta);
    if (!view) {
      NcError.get(context).viewNotFound(param.viewId);
    }
    if (view.type !== ViewTypes.GRID) {
      NcError.get(context).invalidRequestBody('View is not a grid view');
    }
    await assertNotLockedViewOnLaneProduction(
      context,
      view.id,
      undefined,
      ncMeta,
    );
    assertViewConfigEditable(context, view, param.req);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    // ids of other views are skipped
    const ownColumns = new Map(
      (await GridViewColumn.list(context, view.id, ncMeta)).map((c) => [
        c.id,
        c,
      ]),
    );
    if (!Object.keys(param.columnWidths).some((id) => ownColumns.has(id))) {
      NcError.get(context).invalidRequestBody(
        'columnWidths has no column of this view',
      );
    }
    for (const [gridViewColumnId, width] of Object.entries(
      param.columnWidths,
    )) {
      const oldGridViewColumn = ownColumns.get(gridViewColumnId);
      if (!oldGridViewColumn) continue;
      await GridViewColumn.update(context, gridViewColumnId, { width }, ncMeta);

      // one audit row per changed column, as gridColumnUpdate writes
      if (param.req && oldGridViewColumn.width !== width) {
        this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
          oldViewColumn: oldGridViewColumn,
          viewColumn: { width },
          column: await Column.get(
            context,
            { colId: oldGridViewColumn.fk_column_id },
            ncMeta,
          ),
          view,
          req: param.req,
          context,
        });
      }
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_refresh',
          payload: { fk_view_id: view.id },
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return true;
  }

  async gridColumnClearGroupBy(
    context: NcContext,
    param: {
      viewId: string;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const view = await View.get(context, param.viewId, false, ncMeta);
    assertViewConfigEditable(context, view, param.req);

    const qb = ncMeta
      .knex(MetaTable.GRID_VIEW_COLUMNS)
      .where('base_id', '=', context.base_id)
      .andWhere('fk_view_id', '=', param.viewId)
      .update({
        group_by: null,
        group_by_order: null,
        group_by_sort: null,
        group_by_enabled: null,
        aggregation: 'none',
      });
    if (context.workspace_id) {
      qb.andWhere('fk_workspace_id', '=', context.workspace_id);
    }

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      viewWebhookManager =
        param.viewWebhookManager ??
        (
          await (
            await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
              view.fk_model_id,
            )
          ).withViewId(view.id)
        ).forUpdate();
    }

    await NocoCache.deepDel(
      context,
      `${CacheScope.GRID_VIEW_COLUMN}:${param.viewId}`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
    const result = await qb;
    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
    return result;
  }
}
