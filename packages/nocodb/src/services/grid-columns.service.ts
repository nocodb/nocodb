import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { GridViewColumn } from '~/models';

@Injectable()
export class GridColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnList(param: { gridViewId: string }) {
    return await GridViewColumn.list(param.gridViewId);
  }

  async gridColumnUpdate(param: {
    gridViewColumnId: string;
    grid: GridColumnReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.grid,
    );

    const res = await GridViewColumn.update(param.gridViewColumnId, param.grid);

    this.appHooksService.emit(AppEvents.GRID_COLUMN_UPDATE, {
      req: param.req,
    });

    return res;
  }
}
