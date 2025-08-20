import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, NcApiVersion, UITypes } from 'nocodb-sdk';
import { NcError } from 'src/helpers/ncError';
import type {
  ColumnReqType,
  FieldUpdateV3Type,
  FieldV3Type,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ReusableParams } from '~/services/columns.service';
import { ColumnsService } from '~/services/columns.service';
import { Column } from '~/models';
import Noco from '~/Noco';
import {
  columnBuilder,
  columnV3ToV2Builder,
} from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';

@Injectable()
export class ColumnsV3Service {
  constructor(protected readonly columnsService: ColumnsService) {}

  async columnUpdate(
    context: NcContext,
    param: {
      req: any;
      columnId: string;
      column: FieldUpdateV3Type;
      cookie?: any;
      user: UserType;
      reuse?: ReusableParams;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FieldUpdate',
      param.column,
      true,
      context,
    );

    if (param.column.type) {
      validatePayload(
        `swagger-v3.json#/components/schemas/FieldOptions/${param.column.type}`,
        param.column,
        true,
        context,
      );
    }

    let column = await Column.get(context, { colId: param.columnId });

    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }

    const type = (param.column?.type ?? column.uidt) as FieldV3Type['type'];

    const processedColumnReq = columnV3ToV2Builder().build({
      ...param.column,
      type,
    } as FieldV3Type) as ColumnReqType & {
      meta?: any;
      colOptions?: any;
      dtxp?: string;
    };

    if (!processedColumnReq.column_name) {
      processedColumnReq.column_name = column.column_name;
    }
    if (!processedColumnReq.title) {
      processedColumnReq.title = column.title;
    }

    if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(column.uidt)) {
      if (column.meta) {
        column.meta.choices = undefined;
      }
      column.dtxp = (
        column.colOptions as unknown as { options: any[] }
      )?.options
        ?.map((o: any) => `'${o.value}'`)
        .join('');
    }

    // in payload id is required in existing implementation
    column.id = param.columnId;

    await this.columnsService.columnUpdate(context, {
      ...param,
      column: processedColumnReq,
      apiVersion: NcApiVersion.V3,
      req: param.req,
    });

    column = await Column.get(context, { colId: param.columnId });

    // do tranformation
    return columnBuilder().build(column);
  }

  async columnGet(context: NcContext, param: { columnId: string }) {
    const column = await Column.get(context, { colId: param.columnId });
    if (!column) {
      NcError.get(context).fieldNotFound(param.columnId);
    }
    return columnBuilder().build(column);
  }

  async columnAdd(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: FieldV3Type;
      user: UserType;
      reuse?: ReusableParams;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/CreateField',
      param.column,
      true,
      context,
    );
    validatePayload(
      `swagger-v3.json#/components/schemas/FieldOptions/${param.column.type}`,
      param.column,
      true,
      context,
    );

    const column = columnV3ToV2Builder().build(
      param.column,
    ) as ColumnReqType & {
      parentId?: string;
      meta?: any;
      colOptions?: any;
      dtxp?: string;
    };

    // if LTAR column then define tablr id as parent id in request
    if (isLinksOrLTAR(column) && !column.parentId) {
      column.parentId = param.tableId;
    }

    if (
      [UITypes.SingleSelect, UITypes.MultiSelect].includes(
        column.uidt as UITypes,
      )
    ) {
      if (column.meta) {
        column.meta.choices = undefined;
      }
      column.dtxp = column.colOptions?.options
        ?.map((o: any) => `${o.value}`)
        .join('');
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
    await this.columnsService.columnDelete(context, param, ncMeta);

    return {};
  }
}
