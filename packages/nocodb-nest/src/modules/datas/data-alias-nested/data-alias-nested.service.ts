import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import { NcError } from '../../../helpers/catchError';
import { PagedResponseImpl } from '../../../helpers/PagedResponse';
import { Base, Model } from '../../../models';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { getColumnByIdOrName, getViewAndModelByAliasOrId } from '../helpers';
import type { PathParams } from '../helpers';

@Injectable()
export class DataAliasNestedService {
  // todo: handle case where the given column is not ltar
  async mmList(
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);

    if (column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.badRequest('Column is not LTAR');

    const data = await baseModel.mmList(
      {
        colId: column.id,
        parentId: param.rowId,
      },
      param.query as any,
    );
    const count: any = await baseModel.mmListCount({
      colId: column.id,
      parentId: param.rowId,
    });

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async mmExcludedList(
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });
    const column = await getColumnByIdOrName(param.columnName, model);

    const data = await baseModel.getMmChildrenExcludedList(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    const count = await baseModel.getMmChildrenExcludedListCount(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async hmExcludedList(
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);

    const data = await baseModel.getHmChildrenExcludedList(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    const count = await baseModel.getHmChildrenExcludedListCount(
      {
        colId: column.id,
        pid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async btExcludedList(
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);

    const data = await baseModel.getBtChildrenExcludedList(
      {
        colId: column.id,
        cid: param.rowId,
      },
      param.query,
    );

    const count = await baseModel.getBtChildrenExcludedListCount(
      {
        colId: column.id,
        cid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  // todo: handle case where the given column is not ltar
  async hmList(
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);

    if (column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.badRequest('Column is not LTAR');

    const data = await baseModel.hmList(
      {
        colId: column.id,
        id: param.rowId,
      },
      param.query,
    );

    const count = await baseModel.hmListCount({
      colId: column.id,
      id: param.rowId,
    });

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    } as any);
  }

  async relationDataRemove(
    param: PathParams & {
      columnName: string;
      rowId: string;
      refRowId: string;
      cookie: any;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);

    await baseModel.removeChild({
      colId: column.id,
      childId: param.refRowId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  // todo: Give proper error message when reference row is already related and handle duplicate ref row id in hm
  async relationDataAdd(
    param: PathParams & {
      columnName: string;
      rowId: string;
      refRowId: string;
      cookie: any;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    if (!model) NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const column = await getColumnByIdOrName(param.columnName, model);
    await baseModel.addChild({
      colId: column.id,
      childId: param.refRowId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }
}
