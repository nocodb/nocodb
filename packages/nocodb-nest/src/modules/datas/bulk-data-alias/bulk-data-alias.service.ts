import { Injectable } from '@nestjs/common';
import { isSystemColumn, UITypes } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import { NcError } from '../../../helpers/catchError';
import { Base, Column, Model, Project, View } from '../../../models';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { getViewAndModelByAliasOrId } from '../helpers';
import type { PathParams } from '../helpers';
import type { BaseModelSqlv2 } from '../../../db/BaseModelSqlv2';

type BulkOperation =
  | 'bulkInsert'
  | 'bulkUpdate'
  | 'bulkUpdateAll'
  | 'bulkDelete'
  | 'bulkDeleteAll';

@Injectable()
export class BulkDataAliasService {
  async getModelViewBase(param: PathParams) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const base = await Base.get(model.base_id);
    return { model, view, base };
  }

  async executeBulkOperation<T extends BulkOperation>(
    param: PathParams & {
      operation: T;
      options: Parameters<(typeof BaseModelSqlv2.prototype)[T]>;
    },
  ) {
    const { model, view, base } = await this.getModelViewBase(param);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });
    return await baseModel[param.operation].apply(null, param.options);
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataInsert(
    param: PathParams & {
      body: any;
      cookie: any;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkInsert',
      options: [param.body, { cookie: param.cookie }],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataUpdate(
    param: PathParams & {
      body: any;
      cookie: any;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkUpdate',
      options: [param.body, { cookie: param.cookie }],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataUpdateAll(
    param: PathParams & {
      body: any;
      cookie: any;
      query: any;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkUpdateAll',
      options: [param.query, param.body, { cookie: param.cookie }],
    });
  }

  async bulkDataDelete(
    param: PathParams & {
      body: any;
      cookie: any;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkDelete',
      options: [param.body, { cookie: param.cookie }],
    });
  }

  // todo: Integrate with filterArrJson bulkDataDeleteAll
  async bulkDataDeleteAll(
    param: PathParams & {
      query: any;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkDeleteAll',
      options: [param.query],
    });
  }
}
