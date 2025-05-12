import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ColumnsService as ColumnsServiceCE,
  type CustomLinkProps,
  reuseOrSave,
} from 'src/services/columns.service';
import {
  customLinkSupportedTypes,
  isLinksOrLTAR,
  isVirtualCol,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { pluralize, singularize } from 'inflection';
import type {
  ColumnReqType,
  LinkToAnotherColumnReqType,
  NcApiVersion,
  UserType,
} from 'nocodb-sdk';
import type { ReusableParams } from '~/services/columns.service.type';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Source } from '~/models';
import {
  Base,
  Column,
  Filter,
  LinkToAnotherRecordColumn,
  Model,
  View,
} from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import {
  createHmAndBtColumn,
  createOOColumn,
  generateIndexNameForCustomLink,
  validatePayload,
} from '~/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/catchError';
import validateParams from '~/helpers/validateParams';
import { getUniqueColumnAliasName } from '~/helpers/getUniqueName';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';

@Injectable()
export class ColumnsService extends ColumnsServiceCE {
  constructor(
    protected readonly metaService: MetaService,
    protected readonly appHooksService: AppHooksService,
    @Inject(forwardRef(() => 'FormulaColumnTypeChanger'))
    protected readonly formulaColumnTypeChanger,
  ) {
    super(metaService, appHooksService, formulaColumnTypeChanger);
  }

  async columnAdd<T extends NcApiVersion = NcApiVersion | null | undefined>(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: ColumnReqType;
      user: UserType;
      reuse?: any;
      suppressFormulaError?: boolean;
      apiVersion?: T;
    },
  ): Promise<T extends NcApiVersion.V3 ? Column : Model> {
    // if column_name is defined and title is not defined, set title to column_name
    if (param.column.column_name && !param.column.title) {
      param.column.title = param.column.column_name;
    }

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

      const { limit: columnLimitForWorkspace, plan } = await getLimit(
        PlanLimitTypes.LIMIT_COLUMN_PER_TABLE,
        workspaceId,
      );

      if (columnsInTable >= columnLimitForWorkspace) {
        NcError.planLimitExceeded(
          `Only ${columnLimitForWorkspace} columns are allowed, for more please upgrade your plan`,
          {
            plan: plan?.title,
            limit: columnLimitForWorkspace,
            current: columnsInTable,
          },
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

  async createLTARColumn(
    context: NcContext,
    param: {
      tableId: string;
      column: ColumnReqType;
      source: Source;
      base: Base;
      reuse?: ReusableParams;
      colExtra?: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    if ((param.column as any).is_custom_link) {
      validateParams(['custom'], param.column as any);
      validateParams(
        ['column_id', 'ref_model_id', 'ref_column_id'],
        (param.column as any).custom,
      );

      const ltarCustomProps: CustomLinkProps = (param.column as any).custom;

      const child = await Model.get(context, ltarCustomProps.ref_model_id);
      const parent = await Model.get(context, param.tableId);

      const childColumn = await Column.get(context, {
        colId: ltarCustomProps.ref_column_id,
      });
      const parentColumn = await Column.get(context, {
        colId: ltarCustomProps.column_id,
      });

      await this.validateColumnTypes(context, {
        ltarCustomProps,
        isMm:
          (param.column as LinkToAnotherColumnReqType).type ===
          RelationTypes.MANY_TO_MANY,
        columns: [childColumn, parentColumn],
      });

      const childView: View | null = (
        param.column as LinkToAnotherColumnReqType
      )?.childViewId
        ? await View.getByTitleOrId(context, {
            fk_model_id: child.id,
            titleOrId: (param.column as LinkToAnotherColumnReqType).childViewId,
          })
        : null;

      if (
        (param.column as LinkToAnotherColumnReqType).type === 'hm' ||
        (param.column as LinkToAnotherColumnReqType).type === 'bt'
      ) {
        await createHmAndBtColumn(
          context,
          param.req,
          child,
          parent,
          childColumn,
          childView,
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
          context,
          param.req,
          child,
          parent,
          childColumn,
          childView,
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
      } else if (
        (param.column as LinkToAnotherColumnReqType).type ===
        RelationTypes.MANY_TO_MANY
      ) {
        await Column.insert(context, {
          title: getUniqueColumnAliasName(
            await child.getColumns(context),
            pluralize(parent.title),
          ),
          uidt: param.column.uidt,
          type: 'mm',

          // ref_db_alias
          fk_model_id: child.id,
          // db_type:

          fk_child_column_id: childColumn.id,
          fk_parent_column_id: parentColumn.id,

          fk_mm_model_id: ltarCustomProps.junc_model_id,
          fk_mm_child_column_id: ltarCustomProps.junc_ref_column_id,
          fk_mm_parent_column_id: ltarCustomProps.junc_column_id,
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
        await Column.insert(context, {
          title: getUniqueColumnAliasName(
            await parent.getColumns(context),
            param.column.title ?? pluralize(child.title),
          ),

          uidt: param.column.uidt,
          type: 'mm',

          fk_model_id: parent.id,

          fk_mm_model_id: ltarCustomProps.junc_model_id,
          fk_mm_child_column_id: ltarCustomProps.junc_column_id,
          fk_mm_parent_column_id: ltarCustomProps.junc_ref_column_id,

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

      await this.createCustomLinkIndexIfMissing(context, {
        ltarCustomProps,
        isMm:
          (param.column as LinkToAnotherColumnReqType).type ===
          RelationTypes.MANY_TO_MANY,
        reuse: param.reuse,
        source: param.source,
      });

      return;
    }

    return super.createLTARColumn(context, param);
  }

  private async validateColumnTypes(
    context: NcContext,
    {
      isMm = false,
      ltarCustomProps,
      columns = [],
    }: { ltarCustomProps: CustomLinkProps; isMm?: boolean; columns?: Column[] },
  ) {
    if (isMm) {
      const junctionColumn = await Column.get(context, {
        colId: ltarCustomProps.junc_column_id,
      });
      const refJunctionColumn = await Column.get(context, {
        colId: ltarCustomProps.junc_ref_column_id,
      });
      columns.push(junctionColumn, refJunctionColumn);
    }

    for (const column of columns) {
      if (!customLinkSupportedTypes.includes(column.uidt)) {
        NcError.badRequest(
          `Column type ${column.uidt} is not supported for custom link`,
        );
      }
    }
  }

  protected async createCustomLinkIndexIfMissing(
    context: NcContext,
    {
      ltarCustomProps,
      isMm = false,
      reuse = {},
      source,
    }: {
      ltarCustomProps: CustomLinkProps;
      isMm: boolean;
      reuse?: ReusableParams;
      source: Source;
    },
  ) {
    // skip if source is not meta
    if (!source.isMeta()) return;

    const columnIds = [
      ltarCustomProps.column_id,
      ltarCustomProps.ref_column_id,
    ];

    if (isMm) {
      columnIds.push(
        ltarCustomProps.junc_column_id,
        ltarCustomProps.junc_ref_column_id,
      );
    }

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr(context, {
        id: source.base_id,
      }),
    );

    for (const columnId of columnIds) {
      const column = await Column.get(context, { colId: columnId });

      // skip if,
      // 1. column is virtual
      // 2. column has custom index name(already indexed)
      // 3. column is pk
      // 4. column is foreign key
      // 5. column is LongText
      if (
        isVirtualCol(column) ||
        column.custom_index_name ||
        column.pk ||
        column.uidt === UITypes.ForeignKey ||
        column.uidt === UITypes.LongText
      ) {
        continue;
      }

      const model = await Model.get(context, column.fk_model_id);
      const indexName = generateIndexNameForCustomLink(
        model.table_name,
        column.title,
      );
      await this.createColumnIndex(context, {
        column: column,
        indexName,
        source: source,
        sqlMgr,
      });

      await Column.updateCustomIndexName(context, columnId, indexName);
    }
  }

  protected async deleteCustomLinkIndex(
    context: NcContext,
    {
      ltarCustomProps,
      isMm = false,
      reuse = {},
      source,
    }: {
      ltarCustomProps: CustomLinkProps;
      isMm: boolean;
      reuse?: ReusableParams;
      source: Source;
    },
  ) {
    const columnIds = [
      ltarCustomProps.column_id,
      ltarCustomProps.ref_column_id,
    ];

    if (isMm) {
      columnIds.push(
        ltarCustomProps.junc_column_id,
        ltarCustomProps.junc_ref_column_id,
      );
    }

    const sqlMgr = await reuseOrSave('sqlMgr', reuse, async () =>
      ProjectMgrv2.getSqlMgr(context, {
        id: source.base_id,
      }),
    );

    for (const columnId of columnIds) {
      const column = await Column.get(context, { colId: columnId });
      if (
        !column.custom_index_name ||
        column.pk ||
        column.uidt === UITypes.ForeignKey
      ) {
        continue;
      }

      // check if column is used in any other custom link
      const isUsedInCustomLink =
        await LinkToAnotherRecordColumn.isUsedInCustomLink(context, column.id);

      // if column is used in any other custom link, skip deleting the index
      if (isUsedInCustomLink) {
        continue;
      }

      const table = await Model.get(context, column.fk_model_id);

      await sqlMgr.sqlOpPlus(source, 'indexDelete', {
        tn: table.table_name,
        columns: [column.column_name],
        indexName: column.custom_index_name,
        non_unique_original: true,
      });

      await Column.updateCustomIndexName(context, column.id, null);
    }
  }
}

export { Altered } from 'src/services/columns.service';
export { ReusableParams } from 'src/services/columns.service.type';
export { getJunctionTableName } from 'src/services/columns.service';
