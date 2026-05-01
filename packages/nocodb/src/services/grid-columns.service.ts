import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
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
import { assertNotLockedViewOnSandboxProduction } from '~/helpers/sandboxGuards';
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

    if (oldGridViewColumn?.fk_view_id) {
      await assertNotLockedViewOnSandboxProduction(
        context,
        oldGridViewColumn.fk_view_id,
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

  async gridColumnClearGroupBy(
    context: NcContext,
    param: { viewId: string; viewWebhookManager?: ViewWebhookManager },
    ncMeta = Noco.ncMeta,
  ) {
    const qb = ncMeta
      .knex(MetaTable.GRID_VIEW_COLUMNS)
      .where('base_id', '=', context.base_id)
      .andWhere('fk_view_id', '=', param.viewId)
      .update({
        group_by: null,
        group_by_order: null,
        group_by_sort: null,
        aggregation: 'none',
      });
    if (context.workspace_id) {
      qb.andWhere('fk_workspace_id', '=', context.workspace_id);
    }

    let viewWebhookManager: ViewWebhookManager;
    if (!param.viewWebhookManager) {
      const view = await View.get(context, param.viewId, false, ncMeta);
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
