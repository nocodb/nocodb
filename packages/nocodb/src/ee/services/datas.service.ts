import { Injectable } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import type { PathParams } from '~/modules/datas/helpers';
import { InternalServerError, NcError } from '~/helpers/catchError';
import { getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model, Source } from '~/models';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

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
    const source = await Source.get(model.source_id);

    try {
      if (
        ((['mysql', 'mysql2'].includes(source.type) &&
          (await isMysqlVersionSupported(source))) ||
          ['pg'].includes(source.type)) &&
        !param.disableOptimization
      ) {
        responseData = await this.dataOptService.list({
          model,
          view,
          params: param.query,
          source,
        });
      } else {
        responseData = await this.getDataList({
          model,
          view,
          query: param.query,
        });
      }
    } catch (e) {
      // if not internal server error log and throw internal server error
      if (!(e instanceof InternalServerError)) console.error(e);
      NcError.internalServerError('Please contact server admin');
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

    const source = await Source.get(model.source_id);

    let row;
    try {
      if (
        ['pg', 'mysql', 'mysql2'].includes(source.type) &&
        !param.disableOptimization
      ) {
        row = await this.dataOptService.read({
          model,
          view,
          params: param.query,
          source,
          id: param.rowId,
        });
      } else {
        const baseModel = await Model.getBaseModelSQL({
          id: model.id,
          viewId: view?.id,
          dbDriver: await NcConnectionMgrv2.get(source),
        });
        row = await baseModel.readByPk(param.rowId, false, param.query, {
          getHiddenColumn: param.getHiddenColumn,
        });
      }
    } catch (e) {
      // if not internal server error log and throw internal server error
      if (!(e instanceof InternalServerError)) console.error(e);
      NcError.internalServerError('Please contact server admin');
    }

    if (!row) {
      NcError.notFound('Row not found');
    }

    return row;
  }
}
