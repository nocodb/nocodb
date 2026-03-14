import { Injectable } from '@nestjs/common';
import { DatasService as DatasServiceCE } from 'src/services/datas.service';
import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import canUseOptimisedQuery from '../utils/canUseOptimisedQuery';
import type { NcApiVersion } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { View } from '~/models';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { Column, Document, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { DataOptService } from '~/services/data-opt/data-opt.service';
import { replaceDynamicFieldWithValue } from '~/db/BaseModelSqlv2';

@Injectable()
export class DatasService extends DatasServiceCE {
  constructor(private readonly dataOptService: DataOptService) {
    super();
  }

  @EEOnly()
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
      includeRowColorColumns?: boolean;
      includeButtonFilterColumns?: boolean;
      skipSortBasedOnOrderCol?: boolean;
      ignoreViewFilterAndSort?: boolean;
      baseModel?: BaseModelSqlv2;
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
    let baseModel: BaseModelSqlv2 = param.baseModel;

    // check for link list query params
    if (param.query?.linkColumnId && param.query?.linkBaseId) {
      baseModel =
        baseModel ||
        (await Model.getBaseModelSQL(context, {
          id: model.id,
          viewId: view?.id,
          dbDriver: await NcConnectionMgrv2.get(source),
          source,
        }));
      const linkContext = {
        ...context,
        base_id: param.query?.linkBaseId,
      };

      const column = await Column.get<LinkToAnotherRecordColumn>(linkContext, {
        colId: param.query.linkColumnId,
      });

      const linkModel = await column.getModel(linkContext);

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
        ? (await Filter.rootFilterListByLink(linkContext, {
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
        linkModel.columns || (await linkModel.getColumns(linkContext)),
        baseModel.readByPk,
      )(linkConditions);
    }

    if (
      await canUseOptimisedQuery(context, {
        source,
        disableOptimization: param.disableOptimization,
      })
    ) {
      baseModel =
        baseModel ||
        (await Model.getBaseModelSQL(context, {
          id: model.id,
          viewId: view?.id,
          dbDriver: await NcConnectionMgrv2.get(source),
          source,
        }));

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
        skipSortBasedOnOrderCol: param.skipSortBasedOnOrderCol,
        ignoreViewFilterAndSort: param.ignoreViewFilterAndSort,
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
        skipSortBasedOnOrderCol: param.skipSortBasedOnOrderCol,
        ignoreViewFilterAndSort: param.ignoreViewFilterAndSort,
      });
    }

    await this.injectDocFieldValues(context, model, responseData?.list);

    return responseData;
  }

  /**
   * Inject doc existence (doc_id or null) into row data for Doc virtual columns.
   * Runs a single batch query against nc_docs_v2 per page load.
   */
  private async injectDocFieldValues(
    context: NcContext,
    model: Model,
    rows: Record<string, any>[],
  ) {
    if (!rows?.length) return;

    const columns = model.columns || (await model.getColumns(context));
    const docColumns = columns.filter((c) => c.uidt === UITypes.Doc);
    if (!docColumns.length) return;

    // Extract PKs from rows
    const pkColumns = columns.filter((c) => c.pk);
    const rowIds: string[] = [];
    for (const row of rows) {
      const pk = pkColumns.map((c) => row[c.title]).join('___');
      if (pk) rowIds.push(pk);
    }
    if (!rowIds.length) return;

    const columnIds = docColumns.map((c) => c.id);
    const existenceMap = await Document.listExistenceByColumnsAndRows(
      context,
      columnIds,
      rowIds,
    );

    for (const row of rows) {
      const pk = pkColumns.map((c) => row[c.title]).join('___');
      for (const col of docColumns) {
        const colMap = existenceMap.get(col.id);
        row[col.title] = colMap?.get(pk) || null;
      }
    }
  }

  @EEOnly()
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

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    let row;
    if (
      await canUseOptimisedQuery(context, {
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
      row = await baseModel.readByPk(param.rowId, false, param.query, {
        getHiddenColumn: param.getHiddenColumn,
        throwErrorIfInvalidParams: true,
      });
    }

    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    await this.injectDocFieldValues(context, model, [row]);

    return row;
  }
}
