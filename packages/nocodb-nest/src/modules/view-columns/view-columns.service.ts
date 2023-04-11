import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { validatePayload } from '../../helpers';
import { View } from '../../models';
import type { ViewColumnReqType, ViewColumnUpdateReqType } from 'nocodb-sdk';

@Injectable()
export class ViewColumnsService {
  async columnList(param: { viewId: string }) {
    return await View.getColumns(param.viewId);
  }
  async columnAdd(param: { viewId: string; column: ViewColumnReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnReq',
      param.column,
    );

    const viewColumn = await View.insertOrUpdateColumn(
      param.viewId,
      param.column.fk_column_id,
      {
        order: param.column.order,
        show: param.column.show,
      },
    );
    T.emit('evt', { evt_type: 'viewColumn:inserted' });

    return viewColumn;
  }

  async columnUpdate(param: {
    viewId: string;
    columnId: string;
    column: ViewColumnUpdateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewColumnUpdateReq',
      param.column,
    );

    const result = await View.updateColumn(
      param.viewId,
      param.columnId,
      param.column,
    );
    T.emit('evt', { evt_type: 'viewColumn:updated' });
    return result;
  }
}
