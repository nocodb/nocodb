import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import { nocoExecute } from 'nc-help';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import View from '../../../../noco-models/View';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import Project from '../../../../noco-models/Project';
import { NcError } from '../../helpers/catchError';

export async function dataList(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  res.json(await getDataList(model, view, req));
}

async function dataInsert(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.insert(req.body, null, req));
}

async function dataUpdate(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.updateByPk(req.params.rowId, req.body, null, req));
}

async function dataDelete(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.delByPk(req.params.rowId, null, req));
}
async function getDataList(model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const requestObj = await baseModel.defaultResolverReq(req.query);

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  const data = await nocoExecute(
    requestObj,
    await baseModel.list(listArgs),
    {},
    listArgs
  );

  const count = await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    ...req.query,
    count
  });
}
async function getViewAndModelFromRequest(req) {
  const project = await Project.get(req.params.projectId);
  const model = await Model.getByAliasOrId({
    project_id: project.id,
    base_id: project.bases?.[0]?.id,
    aliasOrId: req.params.tableName
  });
  const view =
    req.params.viewName &&
    (await View.getByTitleOrId({
      titleOrId: req.params.viewName,
      fk_model_id: model.id
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
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(
    await nocoExecute(
      await baseModel.defaultResolverReq(),
      await baseModel.readByPk(req.params.rowId),
      {},
      {}
    )
  );
}

const router = Router({ mergeParams: true });

router.get('/nc/:projectId/api/v2/:tableName', ncMetaAclMw(dataList));

router.post('/nc/:projectId/api/v2/:tableName', ncMetaAclMw(dataInsert));
router.get('/nc/:projectId/api/v2/:tableName/:rowId', ncMetaAclMw(dataRead));
router.put('/nc/:projectId/api/v2/:tableName/:rowId', ncMetaAclMw(dataUpdate));
router.delete(
  '/nc/:projectId/api/v2/:tableName/:rowId',
  ncMetaAclMw(dataDelete)
);

export default router;
