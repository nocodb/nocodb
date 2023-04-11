import { Injectable } from '@nestjs/common';
import { getViewAndModelByAliasOrId, OldPathParams } from '../helpers';
import getAst from '../../../helpers/getAst';
import { NcError } from '../../../helpers/catchError';
import {
  Base,
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
  Project,
  View,
} from '../../../models';
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import { nocoExecute } from 'nc-help';

@Injectable()
export class OldDatasService {
  async dataList(param: OldPathParams & { query: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const { ast } = await getAst({
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

  async dataCount(param: OldPathParams & { query: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const listArgs: any = { ...param.query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    return await baseModel.count(listArgs);
  }

  async dataInsert(param: OldPathParams & { body: unknown; cookie: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataRead(param: OldPathParams & { query: any; rowId: string }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const { ast } = await getAst({
      query: param.query,
      model,
      view,
    });

    return await nocoExecute(
      ast,
      await baseModel.readByPk(param.params.rowId),
      {},
      {},
    );
  }

  async dataUpdate(param: OldPathParams & { body: unknown; rowId: string }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.updateByPk(param.rowId, param.body, null, param);
  }

  async dataDelete(param: OldPathParams & { rowId: string; cookie: any }) {
    const { model, view } = await this.getViewAndModelFromRequest(param);
    const base = await Base.get(model.base_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async getViewAndModelFromRequest(req) {
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
}
