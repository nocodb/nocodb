import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import View from '../../../../noco-models/View';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import Project from '../../../../noco-models/Project';
import { NcError } from '../../helpers/catchError';

async function bulkDataInsert(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkInsert(req.body));
}

async function bulkDataUpdate(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkUpdate(req.body));
}

async function bulkDataUpdateAll(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkUpdateAll(req.query, req.body));
}

async function bulkDataDelete(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkDelete(req.body));
}

async function bulkDataDeleteAll(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequest(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkDeleteAll(req.body));
}

async function getViewAndModelFromRequest(req) {
  const project = await Project.getWithInfoByTitle(req.params.projectName);
  const model = await Model.getByAliasOrId({
    project_id: project.id,
    base_id: project.bases?.[0]?.id,
    aliasOrId: req.params.tableAlias
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

const router = Router({ mergeParams: true });

router.post(
  '/bulkData/:orgs/:projectName/:tableAlias',
  ncMetaAclMw(bulkDataInsert)
);
router.patch(
  '/bulkData/:orgs/:projectName/:tableAlias',
  ncMetaAclMw(bulkDataUpdate)
);
router.patch(
  '/bulkData/:orgs/:projectName/:tableAlias/all',
  ncMetaAclMw(bulkDataUpdateAll)
);
router.delete(
  '/bulkData/:orgs/:projectName/:tableAlias',
  ncMetaAclMw(bulkDataDelete)
);
router.delete(
  '/bulkData/:orgs/:projectName/:tableAlias/all',
  ncMetaAclMw(bulkDataDeleteAll)
);

export default router;
