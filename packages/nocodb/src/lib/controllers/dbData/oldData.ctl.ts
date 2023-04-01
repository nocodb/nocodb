import { Router } from 'express';
import { nocoExecute } from 'nc-help';
import Model from '../../models/Model';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import View from '../../models/View';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import Project from '../../models/Project';
import { NcError } from '../../meta/helpers/catchError';
import apiMetrics from '../../meta/helpers/apiMetrics';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
import type { Request, Response } from 'express';

export async function dataList(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  const { ast } = await getAst({
    query: req.query,
    model,
    view,
  });

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  const data = await nocoExecute(
    ast,
    await baseModel.list(listArgs),
    {},
    listArgs
  );

  res.json(data);
}
export async function dataCount(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}

  const count = await baseModel.count(listArgs);

  res.json({
    count,
  });
}

async function dataInsert(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.insert(req.body, null, req));
}

async function dataUpdate(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.updateByPk(req.params.rowId, req.body, null, req));
}

async function dataDelete(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  res.json(await baseModel.delByPk(req.params.rowId, null, req));
}

async function getViewAndModelFromRequest(req) {
  const project = await Project.getWithInfo(req.params.projectId);
  const model = await Model.getByAliasOrId({
    project_id: project.id,
    aliasOrId: req.params.tableName,
  });
  const view =
    req.params.viewName &&
    (await View.getByTitleOrId({
      titleOrId: req.params.viewName,
      fk_model_id: model.id,
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}

async function dataRead(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: await NcConnectionMgrv2.get(base),
  });

  const { ast } = await getAst({
    query: req.query,
    model,
    view,
  });

  res.json(
    await nocoExecute(ast, await baseModel.readByPk(req.params.rowId), {}, {})
  );
}

const router = Router({ mergeParams: true });

router.get(
  '/nc/:projectId/api/v1/:tableName',
  ncMetaAclMw(dataList, 'dataList')
);

router.get(
  '/nc/:projectId/api/v1/:tableName/count',
  ncMetaAclMw(dataCount, 'dataCount')
);

router.post(
  '/nc/:projectId/api/v1/:tableName',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);
router.get(
  '/nc/:projectId/api/v1/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);
router.patch(
  '/nc/:projectId/api/v1/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);
router.delete(
  '/nc/:projectId/api/v1/:tableName/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

export default router;
