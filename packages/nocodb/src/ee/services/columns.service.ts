import { Injectable } from '@nestjs/common';
import { ColumnsService as ColumnsServiceCE } from 'src/services/columns.service';
import { isLinksOrLTAR } from 'nocodb-sdk';
import type { RelationTypes } from 'nocodb-sdk';
import type {
  ColumnReqType,
  LinkToAnotherColumnReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Source } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import { validatePayload } from '~/helpers';
import { Base, Filter, Model } from '~/models';
import {
  createHmAndBtColumn,
  createOOColumn,
  validatePayload,
} from '~/helpers';
import { Base, Column, Model } from '~/models';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcError } from '~/helpers/catchError';
import validateParams from '~/helpers/validateParams';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';

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

  async createLTARColumn(param: {
    tableId: string;
    column: ColumnReqType;
    source: Source;
    base: Base;
    reuse?: ReusableParams;
    colExtra?: any;
  }) {
    if ((param.column as any).is_custom_link) {
      validateParams(['custom'], param.column as any);
      validateParams(
        ['column_id', 'ref_model_id', 'ref_column_id'],
        (param.column as any).custom,
      );

      const ltarCustomPRops: {
        column_id: string;
        ref_model_id: string;
        ref_column_id: string;
        junc_model_id: string;
        junc_column_id: string;
        junc_ref_column_id: string;
      } = (param.column as any).custom;

      const child = await Model.get(ltarCustomPRops.ref_model_id);
      const parent = await Model.get(param.tableId);

      const childColumn = await Column.get({
        colId: ltarCustomPRops.ref_column_id,
      });
      const parentColumn = await Column.get({
        colId: ltarCustomPRops.column_id,
      });

      if (
        (param.column as LinkToAnotherColumnReqType).type === 'hm' ||
        (param.column as LinkToAnotherColumnReqType).type === 'bt'
      ) {
        await createHmAndBtColumn(
          child,
          parent,
          childColumn,
          (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
          (param.column as LinkToAnotherColumnReqType).title,
          null,
          (param.column as LinkToAnotherColumnReqType).virtual,
          null,
          param.column['meta'],
          true,
          param.colExtra,
          parentColumn,
          true,
        );
      } else if ((param.column as LinkToAnotherColumnReqType).type === 'oo') {
        await createOOColumn(
          child,
          parent,
          childColumn,
          (param.column as LinkToAnotherColumnReqType).type as RelationTypes,
          (param.column as LinkToAnotherColumnReqType).title,
          null,
          (param.column as LinkToAnotherColumnReqType).virtual,
          null,
          param.column['meta'],
          param.colExtra,
          parentColumn,
          true,
        );
      } else if ((param.column as LinkToAnotherColumnReqType).type === 'mm') {
        await Column.insert({
          title: getUniqueColumnAliasName(
            await child.getColumns(),
            pluralize(parent.title),
          ),
          uidt: param.column.uidt,
          type: 'mm',

          // ref_db_alias
          fk_model_id: child.id,
          // db_type:

          fk_child_column_id: childColumn.id,
          fk_parent_column_id: parentColumn.id,

          fk_mm_model_id: ltarCustomPRops.junc_model_id,
          fk_mm_child_column_id: ltarCustomPRops.junc_ref_column_id,
          fk_mm_parent_column_id: ltarCustomPRops.junc_column_id,
          fk_related_model_id: parent.id,
          virtual: (param.column as LinkToAnotherColumnReqType).virtual,
          meta: {
            plural: pluralize(parent.title),
            singular: singularize(parent.title),
            custom: true,
          },
          // if self referencing treat it as system field to hide from ui
          system: parent.id === child.id,
        });
        await Column.insert({
          title: getUniqueColumnAliasName(
            await parent.getColumns(),
            param.column.title ?? pluralize(child.title),
          ),

          uidt: param.column.uidt,
          type: 'mm',

          fk_model_id: parent.id,

          fk_mm_model_id: ltarCustomPRops.junc_model_id,
          fk_mm_child_column_id: ltarCustomPRops.junc_column_id,
          fk_mm_parent_column_id: ltarCustomPRops.junc_ref_column_id,

          fk_child_column_id: parentColumn.id,
          fk_parent_column_id: childColumn.id,

          fk_related_model_id: child.id,
          virtual: (param.column as LinkToAnotherColumnReqType).virtual,
          meta: {
            plural: param.column['meta']?.plural || pluralize(child.title),
            singular:
              param.column['meta']?.singular || singularize(child.title),
            custom: true,
          },

          // column_order and view_id if provided
          ...param.colExtra,
        });
      }

      return;
    }

    return super.createLTARColumn(param);
  }
}

export { Altered } from 'src/services/columns.service';
