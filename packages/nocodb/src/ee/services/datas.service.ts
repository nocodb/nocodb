import { Injectable, Optional } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import type { PathParams } from '~/modules/datas/helpers';
import { NcError } from '~/helpers/catchError';
import { getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model, Source } from '~/models';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

@Injectable()
export class DatasService extends DatasServiceCE {
  constructor(
    private readonly dataOptService: DataOptService,
    @Optional() @InjectSentry() private readonly sentryClient: SentryService,
  ) {
    super();
  }

  async dataList(
    param: PathParams & {
      query: any;
      disableOptimization?: boolean;
      ignorePagination?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    let responseData;
    const source = await Source.get(model.source_id);

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
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
      });
    } else {
      responseData = await this.getDataList({
        model,
        view,
        query: param.query,
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
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

    const source = await Source.get(model.source_id);

    let row;
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
        throwErrorIfInvalidParams: true,
      });
    } else {
      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });
      row = await baseModel.readByPk(param.rowId, false, param.query, {
        getHiddenColumn: param.getHiddenColumn,
        throwErrorIfInvalidParams: true,
      });
    }

    if (!row) {
      NcError.notFound('Record not found');
    }

    return row;
  }
}
