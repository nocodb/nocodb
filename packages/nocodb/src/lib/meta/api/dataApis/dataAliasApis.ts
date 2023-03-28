import { Request, Response, Router } from 'express';
import Model from '../../../models/Model';
import { nocoExecute } from 'nc-help';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import View from '../../../models/View';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { getViewAndModelFromRequestByAliasOrId } from './helpers';
import apiMetrics from '../../helpers/apiMetrics';
import getAst from '../../../db/sql-data-mapper/lib/sql/helpers/getAst';

async function dataList(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  res.json(await getDataList(model, view, req));
}

async function dataFindOne(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  res.json(await getFindOne(model, view, req));
}

async function dataGroupBy(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  res.json(await getDataGroupBy(model, view, req));
}

async function dataCount(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const countArgs: any = { ...req.query };
  try {
    countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
  } catch (e) {}

  const count = await baseModel.count(countArgs);

  res.json({ count });
}

async function dataInsert(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.insert(req.body, null, req));
}

async function dataUpdate(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.updateByPk(req.params.rowId, req.body, null, req));
}

async function dataDelete(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });
  const message = await baseModel.hasLTARData(req.params.rowId, model);
  if (message.length) {
    res.json({ message });
    return;
  }
  res.json(await baseModel.delByPk(req.params.rowId, null, req));
}
async function getDataList(model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const { ast, dependencyFields } = await getAst({
    model,
    query: req.query,
    view,
  });

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  console.log(
    JSON.stringify(
      dependencyFields,
      (_v, o) => {
        if (o instanceof Set) {
          return [...o];
        }
        return o;
      },
      2
    )
  );
  console.log(JSON.stringify(ast, null, 2));
  const data = await nocoExecute(
    ast,
    await baseModel.list(listArgs),
    {},
    listArgs
  );

  const count = await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    ...req.query,
    count,
  });
}

async function getFindOne(model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const args: any = { ...req.query };
  try {
    args.filterArr = JSON.parse(args.filterArrJson);
  } catch (e) {}
  try {
    args.sortArr = JSON.parse(args.sortArrJson);
  } catch (e) {}

  const data = await baseModel.findOne(args);

  const { ast } = await getAst({ model, query: args, view })
  return data
    ? await nocoExecute(
        ast,
        data,
        {},
        {}
      )
    : {};
}

async function getDataGroupBy(model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const listArgs: any = { ...req.query };
  const data = await baseModel.groupBy({ ...req.query });
  const count = await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    ...req.query,
    count,
  });
}

async function dataRead(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const { ast } = await getAst({ model, query: req.query, view })

  res.json(
    await nocoExecute(
      ast,
      await baseModel.readByPk(req.params.rowId),
      {},
      {}
    )
  );
}

async function dataExist(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.exist(req.params.rowId));
}
const router = Router({ mergeParams: true });

// table data crud apis
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/find-one',
  apiMetrics,
  ncMetaAclMw(dataFindOne, 'dataFindOne')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/groupby',
  apiMetrics,
  ncMetaAclMw(dataGroupBy, 'dataGroupBy')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/exist',
  apiMetrics,
  ncMetaAclMw(dataExist, 'dataExist')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/count',
  apiMetrics,
  ncMetaAclMw(dataCount, 'dataCount')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/count',
  apiMetrics,
  ncMetaAclMw(dataCount, 'dataCount')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);

router.patch(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);

router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

// table view data crud apis
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  apiMetrics,
  ncMetaAclMw(dataList, 'dataList')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/find-one',
  apiMetrics,
  ncMetaAclMw(dataFindOne, 'dataFindOne')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/groupby',
  apiMetrics,
  ncMetaAclMw(dataGroupBy, 'dataGroupBy')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId/exist',
  apiMetrics,
  ncMetaAclMw(dataExist, 'dataExist')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);

router.patch(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);

router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

export default router;
