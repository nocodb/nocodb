import { Request, Response, Router } from 'express';
import Model from '../../models/Model';
import Base from '../../models/Base';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import {
  getColumnByIdOrName,
  getViewAndModelFromRequestByAliasOrId,
} from '../dataApis/helpers';
import { NcError } from '../../meta/helpers/catchError';
import apiMetrics from '../../meta/helpers/apiMetrics';

// todo: handle case where the given column is not ltar
export async function mmList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.mmList(
    {
      colId: column.id,
      parentId: req.params.rowId,
    },
    req.query as any
  );
  const count: any = await baseModel.mmListCount({
    colId: column.id,
    parentId: req.params.rowId,
  });

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query,
    })
  );
}

export async function mmExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });
  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getMmChildrenExcludedList(
    {
      colId: column.id,
      pid: req.params.rowId,
    },
    req.query
  );

  const count = await baseModel.getMmChildrenExcludedListCount(
    {
      colId: column.id,
      pid: req.params.rowId,
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query,
    })
  );
}

export async function hmExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getHmChildrenExcludedList(
    {
      colId: column.id,
      pid: req.params.rowId,
    },
    req.query
  );

  const count = await baseModel.getHmChildrenExcludedListCount(
    {
      colId: column.id,
      pid: req.params.rowId,
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query,
    })
  );
}

export async function btExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getBtChildrenExcludedList(
    {
      colId: column.id,
      cid: req.params.rowId,
    },
    req.query
  );

  const count = await baseModel.getBtChildrenExcludedListCount(
    {
      colId: column.id,
      cid: req.params.rowId,
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query,
    })
  );
}

// todo: handle case where the given column is not ltar
export async function hmList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.hmList(
    {
      colId: column.id,
      id: req.params.rowId,
    },
    req.query
  );

  const count = await baseModel.hmListCount({
    colId: column.id,
    id: req.params.rowId,
  });

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query,
    } as any)
  );
}

//@ts-ignore
async function relationDataRemove(req, res) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  await baseModel.removeChild({
    colId: column.id,
    childId: req.params.refRowId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
// todo: Give proper error message when reference row is already related and handle duplicate ref row id in hm
async function relationDataAdd(req, res) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);
  await baseModel.addChild({
    colId: column.id,
    childId: req.params.refRowId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(mmExcludedList, 'mmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(hmExcludedList, 'hmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/bt/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(btExcludedList, 'btExcludedList')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataAdd, 'relationDataAdd')
);
router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataRemove, 'relationDataRemove')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName',
  apiMetrics,
  ncMetaAclMw(mmList, 'mmList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName',
  apiMetrics,
  ncMetaAclMw(hmList, 'hmList')
);

export default router;
