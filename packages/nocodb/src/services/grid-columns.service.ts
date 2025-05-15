import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Column, GridViewColumn, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';

@Injectable()
export class GridColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnList(context: NcContext, param: { gridViewId: string }) {
    return await GridViewColumn.list(context, param.gridViewId);
  }

  async gridColumnUpdate(
    context: NcContext,
    param: {
      gridViewColumnId: string;
      grid: GridColumnReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.grid,
    );

    const oldGridViewColumn = await GridViewColumn.get(
      context,
      param.gridViewColumnId,
    );

    const column = await Column.get(context, {
      colId: oldGridViewColumn.fk_column_id,
    });

    const view = await View.get(context, oldGridViewColumn.fk_view_id);
    const res = await GridViewColumn.update(
      context,
      param.gridViewColumnId,
      param.grid,
    );

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldGridViewColumn,
      // todo: improve and move it to one place rather than repetition
      viewColumn: extractProps(param.grid, [
        'order',
        'show',
        'width',
        'group_by',
        'group_by_order',
        'group_by_sort',
        'aggregation',
      ]),
      column,
      view,
      req: param.req,
      context,
    });

    return res;
  }
}
