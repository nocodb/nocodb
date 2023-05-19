import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { GridViewColumn } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { GridColumnReqType } from 'nocodb-sdk';

@Injectable()
export class GridColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnList(param: { gridViewId: string }) {
    return await GridViewColumn.list(param.gridViewId);
  }

  async gridColumnUpdate(param: {
    gridViewColumnId: string;
    grid: GridColumnReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.grid,
    );

    const res = await GridViewColumn.update(param.gridViewColumnId, param.grid);

    this.appHooksService.emit(AppEvents.GRID_COLUMN_UPDATE, {});

    return res;
  }
}
