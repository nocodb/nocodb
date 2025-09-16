import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { MetaTable } from '~/cli';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
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

  async gridColumnUpdate(
    context: NcContext,
    param: {
      gridViewColumnId: string;
      grid: GridColumnReqType;
      req: NcRequest;
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

    const column = await Column.get(
      context,
      {
        colId: oldGridViewColumn.fk_column_id,
      },
      ncMeta,
    );

    const view = await View.get(context, oldGridViewColumn.fk_view_id, ncMeta);
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

    return res;
  }

  async gridColumnClearGroupBy(
    context: NcContext,
    param: { viewId: string },
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

    await NocoCache.deepDel(
      `${CacheScope.GRID_VIEW_COLUMN}:${param.viewId}`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
    return await qb;
  }
}
