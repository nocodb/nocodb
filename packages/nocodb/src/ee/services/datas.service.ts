import { Injectable, Optional } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { View } from '~/models';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { Column, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';
import { replaceDynamicFieldWithValue } from '~/db/BaseModelSqlv2';

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
    let { model, view: _view } = param as { view?: View; model?: Model };

    if (!model) {
      const modelAndView = await getViewAndModelByAliasOrId(
        param as PathParams,
      );
      model = modelAndView.model;
      _view = modelAndView.view;
    }

    let responseData;
    const source = await Source.get(model.source_id);

    let view = _view;
    let customConditions = [];
    let baseModel: BaseModelSqlv2 = null;

    // check for link list query params
    if (param.query?.linkColumnId) {
      baseModel = await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });

      const column = await Column.get<LinkToAnotherRecordColumn>({
        colId: param.query.linkColumnId,
      });

      const linkModel = await column.getModel();

      if (
        !column ||
        !isLinksOrLTAR(column) ||
        column.colOptions.fk_related_model_id !== model.id
      ) {
        NcError.fieldNotFound(param.query?.linkColumnId, {
          customMessage: `Link column with id ${param.query.linkColumnId} not found`,
        });
      }

      if (column.colOptions.fk_target_view_id) {
        view = await View.get(column.colOptions.fk_target_view_id);
      }

      const linkConditions = column.meta?.enableConditions
        ? (await Filter.rootFilterListByLink({ columnId: column.id })) || []
        : [];

      let rowData = {};

      if (param.query?.linkRowData) {
        try {
          rowData = JSON.parse(param.query.linkRowData);
        } catch {
          // do nothing
        }
      }

      customConditions = await replaceDynamicFieldWithValue(
        rowData,
        null,
        linkModel.columns || (await linkModel.getColumns()),
        baseModel.readByPk,
      )(linkConditions);
    }

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
        baseModel,
        customConditions,
      });
    } else {
      responseData = await this.getDataList({
        model,
        view,
        query: param.query,
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
        limitOverride: param.limitOverride,
        baseModel,
        customConditions,
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
