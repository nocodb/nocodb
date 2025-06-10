import { Injectable } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import { isLinksOrLTAR } from 'nocodb-sdk';
import canUseOptimisedQuery from '../utils/canUseOptimisedQuery';
import type { NcApiVersion } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { View } from '~/models';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { Column, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { replaceDynamicFieldWithValue } from '~/db/BaseModelSqlv2';

@Injectable()
export class DatasService extends DatasServiceCE {
  constructor(private readonly dataOptService: DataOptService) {
    super();
  }

  async dataList(
    context: NcContext,
    param: (PathParams | { view?: View; model: Model }) & {
      query: any;
      disableOptimization?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
    },
  ) {
    let { model, view: _view } = param as { view?: View; model?: Model };

    if (!model) {
      const modelAndView = await getViewAndModelByAliasOrId(
        context,
        param as PathParams,
      );
      model = modelAndView.model;
      _view = modelAndView.view;
    }

    let responseData;
    const source = await Source.get(context, model.source_id);

    let view = _view;
    let customConditions = [];
    let baseModel: BaseModelSqlv2 = null;

    // check for link list query params
    if (param.query?.linkColumnId) {
      baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const column = await Column.get<LinkToAnotherRecordColumn>(context, {
        colId: param.query.linkColumnId,
      });

      const linkModel = await column.getModel(context);

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
        view = await View.get(context, column.colOptions.fk_target_view_id);
      }

      const linkConditions = column.meta?.enableConditions
        ? (await Filter.rootFilterListByLink(context, {
            columnId: column.id,
          })) || []
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
        linkModel.columns || (await linkModel.getColumns(context)),
        baseModel.readByPk,
      )(linkConditions);
    }

    if (
      await canUseOptimisedQuery(context, {
        source,
        disableOptimization: param.disableOptimization,
      })
    ) {
      responseData = await this.dataOptService.list(context, {
        model,
        view,
        params: param.query,
        source,
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
        limitOverride: param.limitOverride,
        baseModel,
        customConditions,
        getHiddenColumns: param.getHiddenColumns,
        apiVersion: param.apiVersion,
        includeSortAndFilterColumns: param.includeSortAndFilterColumns,
      });
    } else {
      responseData = await this.getDataList(context, {
        model,
        view,
        query: param.query,
        throwErrorIfInvalidParams: true,
        ignorePagination: param.ignorePagination,
        limitOverride: param.limitOverride,
        baseModel,
        customConditions,
        getHiddenColumns: param.getHiddenColumns,
        apiVersion: param.apiVersion,
        includeSortAndFilterColumns: param.includeSortAndFilterColumns,
      });
    }

    return responseData;
  }

  async dataRead(
    context: NcContext,
    param: PathParams & {
      query: any;
      rowId: string;
      disableOptimization?: boolean;
      getHiddenColumn?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);

    let row;
    if (
      await await canUseOptimisedQuery(context, {
        source,
        disableOptimization: param.disableOptimization,
      })
    ) {
      row = await this.dataOptService.read(context, {
        model,
        view,
        params: param.query,
        source,
        id: param.rowId,
        throwErrorIfInvalidParams: true,
      });
    } else {
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
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
