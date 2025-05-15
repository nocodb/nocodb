import { Injectable } from '@nestjs/common';
import type { OldPathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';
import { nocoExecute } from '~/utils';
import getAst from '~/helpers/getAst';
import { NcError } from '~/helpers/catchError';
import { Base, Model, Source, View } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class OldDatasService {
  async dataList(context: NcContext, param: OldPathParams & { query: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast } = await getAst(context, {
      query: param.query,
      model,
      view,
    });

    const listArgs: any = { ...param.query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    return await nocoExecute(ast, await baseModel.list(listArgs), {}, listArgs);
  }

  async dataCount(context: NcContext, param: OldPathParams & { query: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const listArgs: any = { ...param.query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    return await baseModel.count(listArgs);
  }

  async dataInsert(
    context: NcContext,
    param: OldPathParams & { body: unknown; cookie: any },
  ) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.insert(param.body, param.cookie);
  }

  async dataRead(
    context: NcContext,
    param: OldPathParams & { query: any; rowId: string },
  ) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast } = await getAst(context, {
      query: param.query,
      model,
      view,
    });

    return await nocoExecute(
      ast,
      await baseModel.readByPk(param.rowId),
      {},
      {},
    );
  }

  async dataUpdate(
    context: NcContext,
    param: OldPathParams & { body: unknown; cookie: any; rowId: string },
  ) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  async dataDelete(
    context: NcContext,
    param: OldPathParams & { rowId: string; cookie: any },
  ) {
    const { model, view } = await this.getViewAndModelFromRequest(
      context,
      param,
    );
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async getViewAndModelFromRequest(context: NcContext, req) {
    const base = await Base.getWithInfo(context, req.params.baseId);
    const model = await Model.getByAliasOrId(context, {
      base_id: base.id,
      aliasOrId: req.params.tableName,
    });
    const view =
      req.params.viewName &&
      (await View.getByTitleOrId(context, {
        titleOrId: req.params.viewName,
        fk_model_id: model.id,
      }));
    if (!model) NcError.tableNotFound(req.params.tableName);
    return { model, view };
  }
}
