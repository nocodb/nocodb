import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, NcApiVersion, UITypes } from 'nocodb-sdk';
import type { ColumnReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ReusableParams } from '~/services/columns.service';
import { ColumnsService } from '~/services/columns.service';
import { Column } from '~/models';
import Noco from '~/Noco';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';

@Injectable()
export class ColumnsV3Service {
  constructor(protected readonly columnsService: ColumnsService) {}

  async columnUpdate(
    context: NcContext,
    param: {
      req?: any;
      columnId: string;
      column: ColumnReqType & { colOptions?: any };
      cookie?: any;
      user: UserType;
      reuse?: ReusableParams;
    },
  ) {
    await Column.get(context, {
      colId: colBody.id,
    })

    const column = columnV3ToV2Builder().build(param.column);

    // if LTAR column then define tablr id as parent id in request
    if (isLinksOrLTAR(column) && !column.parentId) {
      column.parentId = param.tableId;
    }

    const res = await this.columnsService.columnUpdate(context, {
      ...param,
      column,
      apiVersion: NcApiVersion.V3,
    });


    // do tranformation
    return columnBuilder().build(res);
  }

  async columnGet(context: NcContext, param: { columnId: string }) {
    return columnBuilder().build(
      Column.get(context, { colId: param.columnId }),
    );
  }

  async columnAdd(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: ColumnReqType;
      user: UserType;
      reuse?: ReusableParams;
    },
  ) {
    const column = columnV3ToV2Builder().build(param.column);

    // if LTAR column then define tablr id as parent id in request
    if (isLinksOrLTAR(column) && !column.parentId) {
      column.parentId = param.tableId;
    }

    const res = await this.columnsService.columnAdd(context, {
      ...param,
      column,
      apiVersion: NcApiVersion.V3,
    });

    // do tranformation
    return columnBuilder().build(res);
  }

  async columnDelete(
    context: NcContext,
    param: {
      req?: any;
      columnId: string;
      user: UserType;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
    },
    ncMeta = Noco.ncMeta,
  ) {
    return this.columnsService.columnDelete(context, param, ncMeta);
  }
}
