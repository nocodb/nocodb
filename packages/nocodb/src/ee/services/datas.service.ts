import { Injectable, Optional } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import type { PathParams } from '~/helpers/dataHelpers';
import type { View } from '~/models';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
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
    param: (PathParams | { view?: View; model: Model }) & {
      query: any;
      disableOptimization?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
    },
  ) {
    let { model, view } = param as { view?: View; model?: Model };

    if (!model) {
      const modelAndView = await getViewAndModelByAliasOrId(
        param as PathParams,
      );
      model = modelAndView.model;
      view = modelAndView.view;
    }

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
        limitOverride: param.limitOverride,
      });
    } else {
      responseData = await this.getDataList({
        model,
        view,
        query: param.query,
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
        limitOverride: param.limitOverride,
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
      NcError.recordNotFound(param.rowId);
    }

    return row;
  }
}
