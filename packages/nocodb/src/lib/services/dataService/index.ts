import { nocoExecute } from 'nc-help/dist/module/NocoExecute';
import getAst from '../../db/sql-data-mapper/lib/sql/helpers/getAst';
import { NcError } from '../../meta/helpers/catchError';
import { PagedResponseImpl } from '../../meta/helpers/PagedResponse';
import { Base, Model, View } from '../../models';
import Project from '../../models/Project';
import NcConnectionMgrv2 from '../../utils/common/NcConnectionMgrv2';

interface PathParams {
  projectName: string;
  tableName: string;
  viewName: string;
}

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
  await getDataGroupBy({ model, view, query: param.query });
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

  await baseModel.insert(param.body, null, param.cookie);
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
    NcError.notFound();
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

  await baseModel.exist(param.rowId);
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

export async function getViewAndModelByAliasOrId(param: {
  projectName: string;
  tableName: string;
  viewName?: string;
}) {
  const project = await Project.getWithInfoByTitleOrId(param.projectName);

  const model = await Model.getByAliasOrId({
    project_id: project.id,
    aliasOrId: param.tableName,
  });
  const view =
    param.viewName &&
    (await View.getByTitleOrId({
      titleOrId: param.viewName,
      fk_model_id: model.id,
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}
