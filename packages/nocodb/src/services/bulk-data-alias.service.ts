import { Injectable } from '@nestjs/common';
import type { PathParams } from '~/modules/datas/helpers';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model, Source } from '~/models';

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

    const source = await Source.get(model.source_id);
    return { model, view, source };
  }

  async executeBulkOperation<T extends BulkOperation>(
    param: PathParams & {
      operation: T;
      options: Parameters<(typeof BaseModelSqlv2.prototype)[T]>;
    },
  ) {
    const { model, view, source } = await this.getModelViewBase(param);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    return await baseModel[param.operation].apply(null, param.options);
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataInsert(
    param: PathParams & {
      body: any;
      cookie: any;
      chunkSize?: number;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkInsert',
      options: [
        param.body,
        {
          cookie: param.cookie,
          foreign_key_checks: param.foreign_key_checks,
          skip_hooks: param.skip_hooks,
          raw: param.raw,
        },
      ],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataUpdate(
    param: PathParams & {
      body: any;
      cookie: any;
      raw?: boolean;
    },
  ) {
    return await this.executeBulkOperation({
      ...param,
      operation: 'bulkUpdate',
      options: [param.body, { cookie: param.cookie, raw: param.raw }],
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
