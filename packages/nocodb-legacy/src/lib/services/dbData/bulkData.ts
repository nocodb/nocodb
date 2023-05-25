import { Base, Model } from '../../models';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { getViewAndModelByAliasOrId } from './helpers';
import type { PathParams } from './helpers';
import type { BaseModelSqlv2 } from '../../db/sql-data-mapper/lib/sql/BaseModelSqlv2';

type BulkOperation =
  | 'bulkInsert'
  | 'bulkUpdate'
  | 'bulkUpdateAll'
  | 'bulkDelete'
  | 'bulkDeleteAll';

export async function getModelViewBase(param: PathParams) {
  const { model, view } = await getViewAndModelByAliasOrId(param);

  const base = await Base.get(model.base_id);
  return { model, view, base };
}

export async function executeBulkOperation<T extends BulkOperation>(
  param: PathParams & {
    operation: T;
    options: Parameters<typeof BaseModelSqlv2.prototype[T]>;
  }
) {
  const { model, view, base } = await getModelViewBase(param);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });
  return await baseModel[param.operation].apply(null, param.options);
}

// todo: Integrate with filterArrJson bulkDataUpdateAll
export async function bulkDataInsert(
  param: PathParams & {
    body: any;
    cookie: any;
    chunkSize?: number;
    foreign_key_checks?: boolean;
    raw?: boolean;
  }
) {
  return await executeBulkOperation({
    ...param,
    operation: 'bulkInsert',
    options: [param.body, { cookie: param.cookie, foreign_key_checks: param.foreign_key_checks, chunkSize: param.chunkSize, raw: param.raw }],
  });
}

// todo: Integrate with filterArrJson bulkDataUpdateAll
export async function bulkDataUpdate(
  param: PathParams & {
    body: any;
    cookie: any;
  }
) {
  return await executeBulkOperation({
    ...param,
    operation: 'bulkUpdate',
    options: [param.body, { cookie: param.cookie }],
  });
}

// todo: Integrate with filterArrJson bulkDataUpdateAll
export async function bulkDataUpdateAll(
  param: PathParams & {
    body: any;
    cookie: any;
    query: any;
  }
) {
  return await executeBulkOperation({
    ...param,
    operation: 'bulkUpdateAll',
    options: [param.query, param.body, { cookie: param.cookie }],
  });
}

export async function bulkDataDelete(
  param: PathParams & {
    body: any;
    cookie: any;
  }
) {
  return await executeBulkOperation({
    ...param,
    operation: 'bulkDelete',
    options: [param.body, { cookie: param.cookie }],
  });
}

// todo: Integrate with filterArrJson bulkDataDeleteAll
export async function bulkDataDeleteAll(
  param: PathParams & {
    query: any;
  }
) {
  return await executeBulkOperation({
    ...param,
    operation: 'bulkDeleteAll',
    options: [param.query],
  });
}
