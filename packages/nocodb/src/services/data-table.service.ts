import { Injectable } from '@nestjs/common';
import { NcError } from '../helpers/catchError';
import { Base, Model } from '../models';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import { DatasService } from './datas.service';

@Injectable()
export class DataTableService {
  constructor(private datasService: DatasService) {}

  async dataList(param: { projectId?: string; modelId: string; query: any }) {
    const model = await this.getModelAndValidate(param);

    return await this.datasService.getDataList({
      model,
      query: param.query,
    });
  }

  async dataRead(param: {
    projectId?: string;
    modelId: string;
    rowId: string;
    query: any;
  }) {
    const model = await this.getModelAndValidate(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
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
    modelId: string;
    body: any;
    cookie: any;
  }) {
    const model = await this.getModelAndValidate(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataUpdate(param: {
    projectId?: string;
    modelId: string;
    rowId: string;
    body: any;
    cookie: any;
  }) {
    const model = await this.getModelAndValidate(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
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
    rowId: string;
    cookie: any;
  }) {
    const model = await this.getModelAndValidate(param);
    const base = await Base.get(model.base_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    // todo: Should have error http status code
    const message = await baseModel.hasLTARData(param.rowId, model);
    if (message.length) {
      return { message };
    }
    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  private async getModelAndValidate(param: {
    projectId?: string;
    modelId: string;
    query: any;
  }) {
    const model = await Model.get(param.modelId);

    if (model.project_id && model.project_id !== param.projectId) {
      throw new Error('Model not found in project');
    }
    return model;
  }

 async dataCount(param: { projectId?: string; modelId: string; query: any }) {

    const model = await this.getModelAndValidate(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
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
