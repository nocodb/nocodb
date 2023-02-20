import { Request, Response, Router } from 'express';
import Model from '../../../models/Model';
import { nocoExecute } from 'nc-help';
import Base from '../../../models/Base';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import View from '../../../models/View';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { NcError } from '../../helpers/catchError';
import apiMetrics from '../../helpers/apiMetrics';
import getAst from '../../../db/sql-data-mapper/lib/sql/helpers/getAst';

export async function dataList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  res.json(await getDataList(model, view, req));
}

export async function mmList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const key = `${model.title}List`;
  const requestObj: any = {
    [key]: 1,
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async (args) => {
          return await baseModel.mmList(
            {
              colId: req.params.colId,
              parentId: req.params.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count: any = await baseModel.mmListCount({
    colId: req.params.colId,
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
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1,
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async (args) => {
          return await baseModel.getMmChildrenExcludedList(
            {
              colId: req.params.colId,
              pid: req.params.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getMmChildrenExcludedListCount(
    {
      colId: req.params.colId,
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
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1,
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async (args) => {
          return await baseModel.getHmChildrenExcludedList(
            {
              colId: req.params.colId,
              pid: req.params.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getHmChildrenExcludedListCount(
    {
      colId: req.params.colId,
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
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const key = 'List';
  const requestObj: any = {
    [key]: 1,
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async (args) => {
          return await baseModel.getBtChildrenExcludedList(
            {
              colId: req.params.colId,
              cid: req.params.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.getBtChildrenExcludedListCount(
    {
      colId: req.params.colId,
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

export async function hmList(req: Request, res: Response, next) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const key = `${model.title}List`;
  const requestObj: any = {
    [key]: 1,
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async (args) => {
          return await baseModel.hmList(
            {
              colId: req.params.colId,
              id: req.params.rowId,
            },
            args
          );
        },
      },
      {},
      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.hmListCount({
    colId: req.params.colId,
    id: req.params.rowId,
  });

  res.json(
    new PagedResponseImpl(data, {
      totalRows: count,
    } as any)
  );
}

async function dataRead(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId,
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base),
    });

    res.json(
      await nocoExecute(
        await getAst({ model, query: req.query }),
        await baseModel.readByPk(req.params.rowId),
        {},
        {}
      )
    );
  } catch (e) {
    console.log(e);
    NcError.internalServerError(
      'Internal Server Error, check server log for more details'
    );
  }
}

async function dataInsert(req: Request, res: Response, next) {
  try {
    const model = await Model.getByIdOrName({
      id: req.params.viewId,
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base),
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
      id: req.params.viewId,
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base),
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
      id: req.params.viewId,
    });
    if (!model) return next(new Error('Table not found'));

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base),
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
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const requestObj = await getAst({ query: req.query, model, view });

  const listArgs: any = { ...req.query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}

  let data = [];
  let count = 0;
  try {
    data = await nocoExecute(
      requestObj,
      await baseModel.list(listArgs),
      {},
      listArgs
    );
    count = await baseModel.count(listArgs);
  } catch (e) {
    // show empty result instead of throwing error here
    // e.g. search some text in a numeric field
    console.log(e);
    NcError.internalServerError(
      'Internal Server Error, check server log for more details'
    );
  }

  return new PagedResponseImpl(data, {
    count,
    ...req.query,
  });
}
//@ts-ignore
async function relationDataDelete(req, res) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  await baseModel.removeChild({
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
async function relationDataAdd(req, res) {
  const view = await View.get(req.params.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || req.params.viewId,
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  await baseModel.addChild({
    colId: req.params.colId,
    childId: req.params.childId,
    rowId: req.params.rowId,
    cookie: req,
  });

  res.json({ msg: 'success' });
}

const router = Router({ mergeParams: true });

// router.get('/data/:orgs/:projectName/:tableName',apiMetrics,ncMetaAclMw(dataListNew));
// router.get(
//   '/data/:orgs/:projectName/:tableName/views/:viewName',
//   ncMetaAclMw(dataListNew)
// );
//
// router.post(
//   '/data/:orgs/:projectName/:tableName/views/:viewName',
//   ncMetaAclMw(dataInsertNew)
// );
// router.patch(
//   '/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
//   ncMetaAclMw(dataUpdateNew)
// );
// router.delete(
//   '/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
//   ncMetaAclMw(dataDeleteNew)
// );

router.get('/data/:viewId/', apiMetrics, ncMetaAclMw(dataList, 'dataList'));
router.post(
  '/data/:viewId/',
  apiMetrics,
  ncMetaAclMw(dataInsert, 'dataInsert')
);
router.get(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataRead, 'dataRead')
);
router.patch(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataUpdate, 'dataUpdate')
);
router.delete(
  '/data/:viewId/:rowId',
  apiMetrics,
  ncMetaAclMw(dataDelete, 'dataDelete')
);

router.get(
  '/data/:viewId/:rowId/mm/:colId',
  apiMetrics,
  ncMetaAclMw(mmList, 'mmList')
);
router.get(
  '/data/:viewId/:rowId/hm/:colId',
  apiMetrics,
  ncMetaAclMw(hmList, 'hmList')
);

router.get(
  '/data/:viewId/:rowId/mm/:colId/exclude',
  ncMetaAclMw(mmExcludedList, 'mmExcludedList')
);
router.get(
  '/data/:viewId/:rowId/hm/:colId/exclude',
  ncMetaAclMw(hmExcludedList, 'hmExcludedList')
);
router.get(
  '/data/:viewId/:rowId/bt/:colId/exclude',
  ncMetaAclMw(btExcludedList, 'btExcludedList')
);

router.post(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataAdd, 'relationDataAdd')
);
router.delete(
  '/data/:viewId/:rowId/:relationType/:colId/:childId',
  ncMetaAclMw(relationDataDelete, 'relationDataDelete')
);
export default router;
