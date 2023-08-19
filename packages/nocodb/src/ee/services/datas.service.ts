import { Injectable } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import type { PathParams } from '~/modules/datas/helpers';
import { NcError } from '~/helpers/catchError';
import { getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Base, Model } from '~/models';
import { DataOptService } from '~/services/data-opt/data-opt.service';

@Injectable()
export class DatasService extends DatasServiceCE {
  constructor(private readonly dataOptService: DataOptService) {
    super();
  }

  async dataList(
    param: PathParams & { query: any; disableOptimization?: boolean },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    let responseData;
    const base = await Base.get(model.base_id);
    if (base.type === 'pg' && !param.disableOptimization) {
      responseData = await this.dataOptService.list({
        model,
        view,
        params: param.query,
        base,
      });
    } else {
      responseData = await this.getDataList({
        model,
        view,
        query: param.query,
      });
    }

    return responseData;
  }

  async dataRead(
    param: PathParams & {
      query: any;
      rowId: string;
      disableOptimization?: boolean;
      getHiddenColumn?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const base = await Base.get(model.base_id);

    let row;

    if (base.type === 'pg' && !param.disableOptimization) {
      row = await this.dataOptService.read({
        model,
        view,
        params: param.query,
        base,
        id: param.rowId,
      });
    } else {
      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(base),
      });
      row = await baseModel.readByPk(param.rowId, false, param.query, {
        getHiddenColumn: param.getHiddenColumn,
      });
    }

    if (!row) {
      NcError.notFound('Row not found');
    }

    return row;
  }
}
