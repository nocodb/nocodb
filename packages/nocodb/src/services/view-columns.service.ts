import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { ViewColumnReqType, ViewColumnUpdateReqType } from 'nocodb-sdk';

@Injectable()
export class ViewColumnsService {
  constructor(private appHooksService: AppHooksService) {}

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
    this.appHooksService.emit(AppEvents.VIEW_COLUMN_CREATE, {
      viewColumn,
    });

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

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      viewColumn: param.column,
    });

    return result;
  }
}
