import { nocoExecute } from 'nc-help';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
import { NcError } from '../../meta/helpers/catchError';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import { Base, Model, View } from '../../models';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';
import { getViewAndModelByAliasOrId, PathParams } from './helpers';

export async function dataList(param: PathParams & { query: any }) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  const responseData = await getDataList({ model, view, query: param.query });
  return responseData;
}

export async function dataFindOne(param: PathParams & { query: any }) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  return await getFindOne({ model, view, query: param.query });
}

export async function dataGroupBy(param: PathParams & { query: any }) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  return await getDataGroupBy({ model, view, query: param.query });
}

export async function dataCount(param: PathParams & { query: any }) {
  const { model, view } = await getViewAndModelByAliasOrId(param);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const countArgs: any = { ...param.query };
  try {
    countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
  } catch (e) {}

  const count: number = await baseModel.count(countArgs);

  return { count };
}

export async function dataInsert(
  param: PathParams & { body: unknown; cookie: any }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.insert(param.body, null, param.cookie);
}

export async function dataUpdate(
  param: PathParams & { body: unknown; cookie: any; rowId: string }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.updateByPk(
    param.rowId,
    param.body,
    null,
    param.cookie
  );
}

export async function dataDelete(
  param: PathParams & { rowId: string; cookie: any }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  // todo: Should have error http status code
  const message = await baseModel.hasLTARData(param.rowId, model);
  if (message.length) {
    return { message };
  }
  return await baseModel.delByPk(param.rowId, null, param.cookie);
}

export async function getDataList(param: {
  model: Model;
  view: View;
  query: any;
}) {
  const { model, view, query = {} } = param;

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const requestObj = await getAst({ model, query, view });

  const listArgs: any = { ...query };
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
    console.log(e);
    NcError.internalServerError(
      'Internal Server Error, check server log for more details'
    );
  }

  return new PagedResponseImpl(data, {
    ...query,
    count,
  });
}

export async function getFindOne(param: {
  model: Model;
  view: View;
  query: any;
}) {
  const { model, view, query = {} } = param;

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const args: any = { ...query };
  try {
    args.filterArr = JSON.parse(args.filterArrJson);
  } catch (e) {}
  try {
    args.sortArr = JSON.parse(args.sortArrJson);
  } catch (e) {}

  const data = await baseModel.findOne(args);
  return data
    ? await nocoExecute(
        await getAst({ model, query: args, view }),
        data,
        {},
        {}
      )
    : {};
}

export async function getDataGroupBy(param: {
  model: Model;
  view: View;
  query?: any;
}) {
  const { model, view, query = {} } = param;

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const listArgs: any = { ...query };
  const data = await baseModel.groupBy({ ...query });
  const count = await baseModel.count(listArgs);

  return new PagedResponseImpl(data, {
    ...query,
    count,
  });
}

export async function dataRead(
  param: PathParams & { query: any; rowId: string }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const row = await baseModel.readByPk(param.rowId);

  if (!row) {
    NcError.notFound('Row not found');
  }

  return await nocoExecute(
    await getAst({ model, query: param.query, view }),
    row,
    {},
    param.query
  );
}

export async function dataExist(
  param: PathParams & { rowId: string; query: any }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.exist(param.rowId);
}

// todo: Handle the error case where view doesnt belong to model
export async function groupedDataList(
  param: PathParams & { query: any; columnId: string }
) {
  const { model, view } = await getViewAndModelByAliasOrId(param);
  const groupedData = await getGroupedDataList({
    model,
    view,
    query: param.query,
    columnId: param.columnId,
  });
  return groupedData;
}

export async function getGroupedDataList(param: {
  model;
  view: View;
  query: any;
  columnId: string;
}) {
  const { model, view, query = {} } = param;

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  const requestObj = await getAst({ model, query, view });

  const listArgs: any = { ...query };
  try {
    listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
  } catch (e) {}
  try {
    listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
  } catch (e) {}
  try {
    listArgs.options = JSON.parse(listArgs.optionsArrJson);
  } catch (e) {}

  let data = [];

  const groupedData = await baseModel.groupedList({
    ...listArgs,
    groupColumnId: param.columnId,
  });
  data = await nocoExecute(
    { key: 1, value: requestObj },
    groupedData,
    {},
    listArgs
  );
  const countArr = await baseModel.groupedListCount({
    ...listArgs,
    groupColumnId: param.columnId,
  });
  data = data.map((item) => {
    // todo: use map to avoid loop
    const count =
      countArr.find((countItem: any) => countItem.key === item.key)?.count ?? 0;

    item.value = new PagedResponseImpl(item.value, {
      ...query,
      count: count,
    });
    return item;
  });

  return data;
}

export async function dataListByViewId(param: { viewId: string; query: any }) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

  return await getDataList({ model, view, query: param.query });
}

export async function mmList(param: {
  viewId: string;
  colId: string;
  query: any;
  rowId: string;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

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
              colId: param.colId,
              parentId: param.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: param.query } }
    )
  )?.[key];

  const count: any = await baseModel.mmListCount({
    colId: param.colId,
    parentId: param.rowId,
  });

  return new PagedResponseImpl(data, {
    count,
    ...param.query,
  });
}

export async function mmExcludedList(param: {
  viewId: string;
  colId: string;
  query: any;
  rowId: string;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

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
              colId: param.colId,
              pid: param.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: param.query } }
    )
  )?.[key];

  const count = await baseModel.getMmChildrenExcludedListCount(
    {
      colId: param.colId,
      pid: param.rowId,
    },
    param.query
  );

  return new PagedResponseImpl(data, {
    count,
    ...param.query,
  });
}

export async function hmExcludedList(param: {
  viewId: string;
  colId: string;
  query: any;
  rowId: string;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

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
              colId: param.colId,
              pid: param.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: param.query } }
    )
  )?.[key];

  const count = await baseModel.getHmChildrenExcludedListCount(
    {
      colId: param.colId,
      pid: param.rowId,
    },
    param.query
  );

  return new PagedResponseImpl(data, {
    count,
    ...param.query,
  });
}

export async function btExcludedList(param: {
  viewId: string;
  colId: string;
  query: any;
  rowId: string;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) return NcError.notFound('Table not found');

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
              colId: param.colId,
              cid: param.rowId,
            },
            args
          );
        },
      },
      {},

      { nested: { [key]: param.query } }
    )
  )?.[key];

  const count = await baseModel.getBtChildrenExcludedListCount(
    {
      colId: param.colId,
      cid: param.rowId,
    },
    param.query
  );

  return new PagedResponseImpl(data, {
    count,
    ...param.query,
  });
}

export async function hmList(param: {
  viewId: string;
  colId: string;
  query: any;
  rowId: string;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

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
              colId: param.colId,
              id: param.rowId,
            },
            args
          );
        },
      },
      {},
      { nested: { [key]: param.query } }
    )
  )?.[key];

  const count = await baseModel.hmListCount({
    colId: param.colId,
    id: param.rowId,
  });

  return new PagedResponseImpl(data, {
    totalRows: count,
  } as any);
}

export async function dataReadByViewId(param: {
  viewId: string;
  rowId: string;
  query: any;
}) {
  try {
    const model = await Model.getByIdOrName({
      id: param.viewId,
    });
    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: NcConnectionMgrv2.get(base),
    });

    return await nocoExecute(
      await getAst({ model, query: param.query }),
      await baseModel.readByPk(param.rowId),
      {},
      {}
    );
  } catch (e) {
    console.log(e);
    NcError.internalServerError(
      'Internal Server Error, check server log for more details'
    );
  }
}

export async function dataInsertByViewId(param: {
  viewId: string;
  body: any;
  cookie: any;
}) {
  const model = await Model.getByIdOrName({
    id: param.viewId,
  });
  if (!model) return NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.insert(param.body, null, param.cookie);
}

export async function dataUpdateByViewId(param: {
  viewId: string;
  rowId: string;
  body: any;
  cookie: any;
}) {
  const model = await Model.getByIdOrName({
    id: param.viewId,
  });
  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.updateByPk(
    param.rowId,
    param.body,
    null,
    param.cookie
  );
}

export async function dataDeleteByViewId(param: {
  viewId: string;
  rowId: string;
  cookie: any;
}) {
  const model = await Model.getByIdOrName({
    id: param.viewId,
  });
  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  return await baseModel.delByPk(param.rowId, null, param.cookie);
}

export async function relationDataDelete(param: {
  viewId: string;
  colId: string;
  childId: string;
  rowId: string;
  cookie: any;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  await baseModel.removeChild({
    colId: param.colId,
    childId: param.childId,
    rowId: param.rowId,
    cookie: param.cookie,
  });

  return true;
}

export async function relationDataAdd(param: {
  viewId: string;
  colId: string;
  childId: string;
  rowId: string;
  cookie: any;
}) {
  const view = await View.get(param.viewId);

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id || param.viewId,
  });

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base),
  });

  await baseModel.addChild({
    colId: param.colId,
    childId: param.childId,
    rowId: param.rowId,
    cookie: param.cookie,
  });

  return true;
}

export * from './helpers';
