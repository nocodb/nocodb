import { Injectable } from '@nestjs/common';
import { ColumnsService as ColumnsServiceCE } from 'src/services/columns.service';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { ColumnReqType, UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import { validatePayload } from '~/helpers';
import { Base, Filter, Model } from '~/models';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
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

  async columnAdd(param: {
    req: NcRequest;
    tableId: string;
    column: ColumnReqType;
    user: UserType;
    reuse?: any;
  }) {
    validatePayload('swagger.json#/components/schemas/ColumnReq', param.column);

    const model = await Model.get(param.tableId);

    const base = await Base.getWithInfo(model.base_id);

    const source = base.sources.find((s) => s.id === model.source_id);

    if (source && source.isMeta()) {
      const workspaceId = await getWorkspaceForBase(base.id);

      const columnsInTable = await Noco.ncMeta.metaCount(
        null,
        null,
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

    return super.columnAdd(param);
  }

  // if column is links or ltar, insert filters if passed
  protected async postColumnAdd(columnBody: ColumnReqType, tableMeta: Model) {
    if (isLinksOrLTAR(columnBody) && (columnBody as any).filters) {
      const insertedColumn = tableMeta.columns.find(
        (c) => c.title === columnBody.title && isLinksOrLTAR(c),
      );
      for (const filter of (columnBody as any).filters) {
        await Filter.insert({
          ...filter,
          fk_parent_id: null,
          fk_link_col_id: insertedColumn.id,
          fk_view_id: undefined,
        });
      }
    }
  }

  protected async postColumnUpdate(columnBody: ColumnReqType) {
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

            const existingFilter = await Filter.get(filter.id);

            if (existingFilter.fk_link_col_id !== colId) {
              NcError.badRequest('Filter not found');
            }
            if (filter.status === 'update') {
              await Filter.update(filter.id, {
                ...filter,
                fk_link_col_id: colId,
                fk_view_id: undefined,
              });

              if (filter.children) {
                await applyFilterCrud(filter.children, filter.id);
              }
            } else {
              await Filter.delete(filter.id);
            }
          } else if (filter.status === 'create') {
            await Filter.insert({
              ...filter,
              fk_parent_id: parentId,
              fk_link_col_id: colId,
              fk_view_id: undefined,
            });
          } else if (filter.id && filter.children) {
            const existingFilter = await Filter.get(filter.id);

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
