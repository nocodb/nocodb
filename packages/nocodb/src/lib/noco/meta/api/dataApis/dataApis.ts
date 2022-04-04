import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import { nocoExecute } from 'nc-help';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import View from '../../../../noco-models/View';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { NcError } from '../../helpers/catchError';

export async function dataList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  res.json(await getDataList(model, view, req));
}

// async function dataListNew(req: Request, res: Response) {
//   const { model, view } = await getViewAndModelFromRequest(req);
//   res.json(await getDataList(model, view, req));
// }

export async function mmList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = `${model.title}List`;
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.mmList(
            {
              colId: req.params.colId,
              parentId: req.params.rowId
            },
            args
          );
        }
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count: any = await baseModel.mmListCount({
    colId: req.params.colId,
    parentId: req.params.rowId
  });

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function mmExcludedList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.getMmChildrenExcludedList(
            {
              colId: req.params.colId,
              pid: req.params.rowId
            },
            args
          );
        }
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getMmChildrenExcludedListCount(
    {
      colId: req.params.colId,
      pid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function hmExcludedList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.getHmChildrenExcludedList(
            {
              colId: req.params.colId,
              pid: req.params.rowId
            },
            args
          );
        }
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getHmChildrenExcludedListCount(
    {
      colId: req.params.colId,
      pid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function btExcludedList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.getBtChildrenExcludedList(
            {
              colId: req.params.colId,
              cid: req.params.rowId
            },
            args
          );
        }
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getBtChildrenExcludedListCount(
    {
      colId: req.params.colId,
      cid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function hmList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = `${model.title}List`;
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.hmList(
            {
              colId: req.params.colId,
              id: req.params.rowId
            },
            args
          );
        }
      },
      {},
      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.hmListCount({
    colId: req.params.colId,
    id: req.params.rowId
  });

  res.json(
    new PagedResponseImpl(data, {
      totalRows: count
    } as any)
  );
}

async function dataRead(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base)
    });
    const key = `${model.title}Read`;

    res.json(
      (
        await nocoExecute(
          {
            [key]: await baseModel.defaultResolverReq()
          },
          {
            [key]: async id => {
              return await baseModel.readByPk(id);
              // return row ? new ctx.types[model.title](row) : null;
            }
          },
          {},
          { nested: { [key]: req.params.rowId } }
        )
      )?.[key]
    );
  } catch (e) {
    console.log(e);
    res.status(500).json({ msg: e.message });
  }
}

async function dataInsert(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base)
    });

    res.json(await baseModel.insert(req.body, null, req));
  } catch (e) {
    console.log(e);
    res.status(500).json({ msg: e.message });
  }
}

// async function dataInsertNew(req: Request, res: Response) {
//   const { model, view } = await getViewAndModelFromRequest(req);
//
//   const base = await Base.get(model.base_id);
//
//   const baseModel = await Model.getBaseModelSQL({
//     id: model.id,
//     viewId: view?.id,
//     dbDriver: NcConnectionMgrv2.get(base)
//   });
//
//   res.json(await baseModel.insert(req.body, null, req));
// }

// async function dataUpdateNew(req: Request, res: Response) {
//   const { model, view } = await getViewAndModelFromRequest(req);
//   const base = await Base.get(model.base_id);
//
//   const baseModel = await Model.getBaseModelSQL({
//     id: model.id,
//     viewId: view.id,
//     dbDriver: NcConnectionMgrv2.get(base)
//   });
//
//   res.json(await baseModel.updateByPk(req.params.rowId, req.body, null, req));
// }
async function dataUpdate(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base)
    });

    res.json(await baseModel.updateByPk(req.params.rowId, req.body, null, req));
  } catch (e) {
    console.log(e);
    res.status(500).json({ msg: e.message });
  }
}
//
// async function dataDeleteNew(req: Request, res: Response) {
//   const { model, view } = await getViewAndModelFromRequest(req);
//   const base = await Base.get(model.base_id);
//   const baseModel = await Model.getBaseModelSQL({
//     id: model.id,
//     viewId: view.id,
//     dbDriver: NcConnectionMgrv2.get(base)
//   });
//
//   res.json(await baseModel.delByPk(req.params.rowId, null, req));
// }

async function dataDelete(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base)
    });

    res.json(await baseModel.delByPk(req.params.rowId, null, req));
  } catch (e) {
    console.log(e);
    res.status(500).json({ msg: e.message });
  }
}

async function getDataList(model, view: View, req) {
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = `${model._tn}List`;
  const requestObj = {
    [key]: await baseModel.defaultResolverReq(req.query)
  };

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.list(args);
        }
      },
      {},
      { nested: { [key]: listArgs } }
    )
  )?.[key];

  const count = await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    count,
    ...req.query
  });
}
//@ts-ignore
async function relationDataDelete(req, res) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  await baseModel.removeChild({
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
async function relationDataAdd(req, res) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  await baseModel.addChild({
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });

// router.get('/data/:orgs/:projectName/:tableName', ncMetaAclMw(dataListNew));
// router.get(
//   '/data/:orgs/:projectName/:tableName/views/:viewName',
//   ncMetaAclMw(dataListNew)
// );
//
// router.post(
//   '/data/:orgs/:projectName/:tableName/views/:viewName',
//   ncMetaAclMw(dataInsertNew)
// );
// router.put(
//   '/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
//   ncMetaAclMw(dataUpdateNew)
// );
// router.delete(
//   '/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
//   ncMetaAclMw(dataDeleteNew)
// );

router.get('/data/:viewId/', ncMetaAclMw(dataList));
router.post('/data/:viewId/', ncMetaAclMw(dataInsert));
router.get('/data/:viewId/:rowId', ncMetaAclMw(dataRead));
router.put('/data/:viewId/:rowId', ncMetaAclMw(dataUpdate));
router.delete('/data/:viewId/:rowId', ncMetaAclMw(dataDelete));

router.get('/data/:viewId/:rowId/mm/:colId', ncMetaAclMw(mmList));
router.get('/data/:viewId/:rowId/hm/:colId', ncMetaAclMw(hmList));

router.get(
  '/data/:viewId/:rowId/mm/:colId/exclude',
  ncMetaAclMw(mmExcludedList)
);
router.get(
  '/data/:viewId/:rowId/hm/:colId/exclude',
  ncMetaAclMw(hmExcludedList)
);
router.get(
  '/data/:viewId/:rowId/bt/:colId/exclude',
  ncMetaAclMw(btExcludedList)
);

router.post(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataAdd)
);
router.delete(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataDelete)
);
export default router;
