import { Request, Response, Router } from 'express';
import { BaseModelSqlv2 } from '../../db/sql-data-mapper/lib/sql/BaseModelSqlv2';
import Model from '../../models/Model';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { getViewAndModelFromRequestByAliasOrId } from './helpers';
import apiMetrics from '../../meta/helpers/apiMetrics';

type BulkOperation =
  | 'bulkInsert'
  | 'bulkUpdate'
  | 'bulkUpdateAll'
  | 'bulkDelete'
  | 'bulkDeleteAll';

async function getModelViewBase(req: Request) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);
  return { model, view, base };
}

async function executeBulkOperation<T extends BulkOperation>(
  req: Request,
  res: Response,
  operation: T,
  options: Parameters<typeof BaseModelSqlv2.prototype[T]>
) {
  const { model, view, base } = await getModelViewBase(req);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });
  res.json(await baseModel[operation].apply(null, options));
}

async function bulkDataInsert(req: Request, res: Response) {
  await executeBulkOperation(req, res, 'bulkInsert', [
    req.body,
    { cookie: req },
  ]);
}

async function bulkDataUpdate(req: Request, res: Response) {
  await executeBulkOperation(req, res, 'bulkUpdate', [
    req.body,
    { cookie: req },
  ]);
}

// todo: Integrate with filterArrJson bulkDataUpdateAll
async function bulkDataUpdateAll(req: Request, res: Response) {
  await executeBulkOperation(req, res, 'bulkUpdateAll', [
    req.query,
    req.body,
    { cookie: req },
  ]);
}

async function bulkDataDelete(req: Request, res: Response) {
  await executeBulkOperation(req, res, 'bulkDelete', [
    req.body,
    { cookie: req },
  ]);
}

// todo: Integrate with filterArrJson bulkDataDeleteAll
async function bulkDataDeleteAll(req: Request, res: Response) {
  await executeBulkOperation(req, res, 'bulkDeleteAll', [req.query]);
}
const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataInsert, 'bulkDataInsert')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdate, 'bulkDataUpdate')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdateAll, 'bulkDataUpdateAll')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataDelete, 'bulkDataDelete')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataDeleteAll, 'bulkDataDeleteAll')
);

export default router;
