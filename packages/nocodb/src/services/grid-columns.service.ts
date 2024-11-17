import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { GridViewColumn } from '~/models';

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

    const res = await GridViewColumn.update(
      context,
      param.gridViewColumnId,
      param.grid,
    );

    this.appHooksService.emit(AppEvents.GRID_COLUMN_UPDATE, {
      req: param.req,
    });

    return res;
  }
}
