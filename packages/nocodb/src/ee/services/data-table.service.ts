import { Injectable } from '@nestjs/common';
import { DataTableService as DataTableServiceCE } from 'src/services/data-table.service';
import { ViewTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class DataTableService extends DataTableServiceCE {
  async bulkAggregate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    if (view.type !== ViewTypes.GRID) {
      NcError.badRequest('Aggregation is only supported on grid views');
    }

    const listArgs: any = { ...param.query };

    let bulkFilterList = param.body;

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    const data = await baseModel.bulkAggregate(listArgs, bulkFilterList, view);

    return data;
  }
}
