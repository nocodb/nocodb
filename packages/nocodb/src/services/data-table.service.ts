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

    // if array then do bulk insert
    const result = await baseModel.bulkInsert(
      Array.isArray(param.body) ? param.body : [param.body],
      { cookie: param.cookie, insertOneByOneAsFallback: true },
    );

    return Array.isArray(param.body) ? result : result[0];
  }

  async dataUpdate(param: {
    projectId?: string;
    modelId: string;
    viewId?: string;
    // rowId: string;
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

    // return await baseModel.updateByPk(
    //   param.rowId,
    //   param.body,
    //   null,
    //   param.cookie,
    // );

    const res = await baseModel.bulkUpdate(
      Array.isArray(param.body) ? param.body : [param.body],
      { cookie: param.cookie },
    );

    return Array.isArray(param.body) ? res : res[0];
  }

  async dataDelete(param: {
    projectId?: string;
    modelId: string;
    viewId?: string;
    // rowId: string;
    cookie: any;
    body: any;
  }) {
    const { model, view } = await this.getModelAndView(param);
    const base = await Base.get(model.base_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });
    //
    // // todo: Should have error http status code
    // const message = await baseModel.hasLTARData(param.rowId, model);
    // if (message.length) {
    //   return { message };
    // }
    // return await baseModel.delByPk(param.rowId, null, param.cookie);

    const res = await baseModel.bulkUpdate(
      Array.isArray(param.body) ? param.body : [param.body],
      { cookie: param.cookie },
    );

    return Array.isArray(param.body) ? res : res[0];
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

  private async getModelAndView(param: {
    projectId?: string;
    viewId?: string;
    modelId: string;
  }) {
    const model = await Model.get(param.modelId);

    if (!model) {
      NcError.notFound('Model not found');
    }

    if (param.projectId && model.project_id !== param.projectId) {
      throw new Error('Model not belong to project');
    }

    let view: View;

    if (param.viewId) {
      view = await View.get(param.viewId);
      if (!view || (view.fk_model_id && view.fk_model_id !== param.modelId)) {
        NcError.unprocessableEntity('View not belong to model');
      }
    }

    return { model, view };
  }

  private async extractPks({ model, rows }: { rows: any[]; model?: Model }) {
    return await Promise.all(
      rows.map(async (row) => {
        // if not object then return the value
        if (typeof row !== 'object') return row;

        let pk;

        // if model is passed then use the model to get the pk columns and extract the pk values
        if (model) {
          pk = await model.getColumns().then((cols) =>
            cols
              .filter((col) => col.pk)
              .map((col) => row[col.title])
              .join('___'),
          );
        } else {
          // if model is not passed then get all the values and join them
          pk = Object.values(row).join('___');
        }
        return pk;
      }),
    );
  }
}
