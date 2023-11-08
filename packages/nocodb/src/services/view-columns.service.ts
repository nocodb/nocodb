import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { ViewColumnReqType, ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { View } from '~/models';

@Injectable()
export class ViewColumnsService {
  constructor(private appHooksService: AppHooksService) {}

  async columnList(param: { viewId: string }) {
    return await View.getColumns(param.viewId, undefined);
  }
  async columnAdd(param: {
    viewId: string;
    column: ViewColumnReqType;
    req: NcRequest;
  }) {
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
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
      viewColumn,
      req: param.req,
    });

    return viewColumn;
  }

  async columnUpdate(param: {
    viewId: string;
    columnId: string;
    column: ViewColumnUpdateReqType;
    req: NcRequest;
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

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      viewColumn: param.column,
      req: param.req,
    });

    return result;
  }
}
