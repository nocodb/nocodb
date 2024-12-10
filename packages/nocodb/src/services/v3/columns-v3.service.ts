import { Injectable } from '@nestjs/common';
import type {
  ColumnReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ReusableParams } from '~/services/columns.service';
import {
  Column,
} from '~/models';
import Noco from '~/Noco';
import { columnBuilder } from '~/utils/api-v3-data-transformation.builder';
import { ColumnsService } from '~/services/columns.service';

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
    // do the necessary validations and transformations

    const res = await this.columnsService.columnUpdate(context, param);

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
    const res = await this.columnsService.columnAdd(context, param);

    // do tranformation
    return columnBuilder().build(res)
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
