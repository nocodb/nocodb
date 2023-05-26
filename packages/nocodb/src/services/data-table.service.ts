import { Injectable } from '@nestjs/common';
import { NcError } from '../helpers/catchError';
import { Base, Model, View } from '../models';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { DatasService } from './datas.service';

@Injectable()
export class DataTableService {
  constructor(private datasService: DatasService) {}

  async dataList(param: {
    projectId?: string;
    modelId: string;
    query: any;
    viewId?: string;
  }) {
    const { model, view } = await this.getModelAndView(param);

    return await this.datasService.getDataList({
      model,
      view,
      query: param.query,
    });
  }

  async dataRead(param: {
    projectId?: string;
    modelId: string;
    rowId: string;
    viewId?: string;
    query: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const row = await baseModel.readByPk(param.rowId, false, param.query);

    if (!row) {
      NcError.notFound('Row not found');
    }

    return row;
  }

  async dataInsert(param: {
    projectId?: string;
    viewId?: string;
    modelId: string;
    body: any;
    cookie: any;
  }) {
    const { model, view } = await this.getModelAndView(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataUpdate(param: {
    projectId?: string;
    modelId: string;
    viewId?: string;
    rowId: string;
    body: any;
    cookie: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  async dataDelete(param: {
    projectId?: string;
    modelId: string;
    viewId?: string;
    rowId: string;
    cookie: any;
  }) {
    const { model, view } = await this.getModelAndView(param);
    const base = await Base.get(model.base_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    // todo: Should have error http status code
    const message = await baseModel.hasLTARData(param.rowId, model);
    if (message.length) {
      return { message };
    }
    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  private async getModelAndView(param: {
    projectId?: string;
    viewId?: string;
    modelId: string;
  }) {
    const model = await Model.get(param.modelId);

    if (model.project_id && model.project_id !== param.projectId) {
      throw new Error('Model not belong to project');
    }

    let view: View;

    if (param.viewId) {
      view = await View.get(param.viewId);
      if (view.fk_model_id && view.fk_model_id !== param.modelId) {
        throw new Error('View not belong to model');
      }
    }

    return { model, view };
  }

  async dataCount(param: {
    projectId?: string;
    viewId?: string;
    modelId: string;
    query: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const countArgs: any = { ...param.query };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    const count: number = await baseModel.count(countArgs);

    return { count };
  }
}
