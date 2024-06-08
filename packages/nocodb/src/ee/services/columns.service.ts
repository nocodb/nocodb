import { Injectable } from '@nestjs/common';
import { ColumnsService as ColumnsServiceCE } from 'src/services/columns.service';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { ColumnReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import { validatePayload } from '~/helpers';
import { Base, Filter, Model } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ColumnsService extends ColumnsServiceCE {
  constructor(
    protected readonly metaService: MetaService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(metaService, appHooksService);
  }

  async columnAdd(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: ColumnReqType;
      user: UserType;
      reuse?: any;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/ColumnReq', param.column);

    const model = await Model.get(context, param.tableId);

    const base = await Base.getWithInfo(context, model.base_id);

    const source = base.sources.find((s) => s.id === model.source_id);

    if (source && source.isMeta()) {
      const workspaceId = context.workspace_id;

      const columnsInTable = await Noco.ncMeta.metaCount(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          condition: {
            fk_model_id: model.id,
          },
        },
      );

      const columnLimitForWorkspace = await getLimit(
        PlanLimitTypes.COLUMN_LIMIT,
        workspaceId,
      );

      if (columnsInTable >= columnLimitForWorkspace) {
        NcError.badRequest(
          `Only ${columnLimitForWorkspace} columns are allowed, for more please upgrade your plan`,
        );
      }
    }

    return super.columnAdd(context, param);
  }

  // if column is links or ltar, insert filters if passed
  protected async postColumnAdd(
    context: NcContext,
    columnBody: ColumnReqType,
    tableMeta: Model,
  ) {
    if (isLinksOrLTAR(columnBody) && (columnBody as any).filters) {
      const insertedColumn = tableMeta.columns.find(
        (c) => c.title === columnBody.title && isLinksOrLTAR(c),
      );
      for (const filter of (columnBody as any).filters) {
        await Filter.insert(context, {
          ...filter,
          fk_parent_id: null,
          fk_link_col_id: insertedColumn.id,
          fk_view_id: undefined,
        });
      }
    }
  }

  protected async postColumnUpdate(
    context: NcContext,
    columnBody: ColumnReqType,
  ) {
    // if column is links or ltar then iterate and update/delete/insert accordingly
    if (isLinksOrLTAR(columnBody) && (columnBody as any).filters) {
      const colId = (columnBody as any).id;

      if (!colId) {
        return;
      }

      const applyFilterCrud = async (filters, parentId = null) => {
        for (const filter of filters) {
          if (filter.status === 'update' || filter.status === 'delete') {
            // check filter belongs to the column or not, if not skip the filter
            if (!filter.id) continue;

            const existingFilter = await Filter.get(context, filter.id);

            if (existingFilter.fk_link_col_id !== colId) {
              NcError.badRequest('Filter not found');
            }
            if (filter.status === 'update') {
              await Filter.update(context, filter.id, {
                ...filter,
                fk_link_col_id: colId,
                fk_view_id: undefined,
              });

              if (filter.children) {
                await applyFilterCrud(filter.children, filter.id);
              }
            } else {
              await Filter.delete(context, filter.id);
            }
          } else if (filter.status === 'create') {
            await Filter.insert(context, {
              ...filter,
              fk_parent_id: parentId,
              fk_link_col_id: colId,
              fk_view_id: undefined,
            });
          } else if (filter.id && filter.children) {
            const existingFilter = await Filter.get(context, filter.id);

            if (existingFilter.fk_link_col_id !== colId) {
              NcError.badRequest('Filter not found');
            }

            await applyFilterCrud(filter.children, filter.id);
          }
        }
      };

      await applyFilterCrud((columnBody as any).filters);
    }
  }
}

export { Altered } from 'src/services/columns.service';
