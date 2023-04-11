import { Injectable } from '@nestjs/common';
import { GridColumnReqType } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { GridViewColumn } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class GridColumnsService {
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

    T.emit('evt', { evt_type: 'gridViewColumn:updated' });
    return await GridViewColumn.update(param.gridViewColumnId, param.grid);
  }
}
