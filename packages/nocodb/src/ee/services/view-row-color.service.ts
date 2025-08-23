import { Injectable } from '@nestjs/common';
import {
  arrayToNested,
  parseProp,
  PlanFeatureTypes,
  ROW_COLORING_MODE,
  UITypes,
} from 'nocodb-sdk';
import { ViewRowColorService as ViewRowColorServiceCE } from 'src/services/view-row-color.service';
import type {
  ColumnReqType,
  FilterType,
  NcContext,
  RowColoringInfo,
  RowColoringInfoFilter,
  RowColoringInfoFilterRow,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Column, Filter, SelectOption } from '~/models';
import type { ViewMetaRowColoring } from '~/models/View';
import { MetaTable } from '~/cli';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { Model, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';
import { getFeature } from '~/helpers/paymentHelpers';
import { isOnPrem } from '~/utils';

@Injectable()
export class ViewRowColorService extends ViewRowColorServiceCE {
  async getByViewId(params: {
    context: NcContext;
    fk_view_id?: string;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;

    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.get(params.context).viewNotFound(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const model = await Model.get(params.context, view.fk_model_id);

      await model.getColumns(params.context);

      const meta: ViewMetaRowColoring = parseProp(view.meta);

      const selectColumn = model.columns.find(
        (k) => k.id === meta.rowColoringInfo.fk_column_id,
      );

      // If select column is not found that means the column is deleted
      if (!selectColumn) {
        return {
          mode: null,
          conditions: [],
          fk_column_id: null,
          color: null,
          is_set_as_background: null,
          fk_model_id: model.id,
          fk_view_id: view.id,
        };
      }

      const selectOptions = await selectColumn.getColOptions<SelectOption>(
        params.context,
      );

      return {
        options: (selectOptions as any).options,
        mode: ROW_COLORING_MODE.SELECT,
        is_set_as_background: meta.rowColoringInfo.is_set_as_background,
        fk_column_id: meta.rowColoringInfo.fk_column_id,
        selectColumn,
        fk_model_id: model.id,
        fk_view_id: view.id,
      } as RowColoringInfo;
    } else if (view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
      const result = {
        mode: ROW_COLORING_MODE.FILTER,
        fk_model_id: view.fk_model_id,
        fk_view_id: view.id,
        conditions: [],
      } as RowColoringInfo;

      const rowColorConditions = await RowColorCondition.getByViewId(
        params.context,
        view.id,
      );
      const rawFilters = await ncMeta.metaList2(
        params.context.workspace_id,
        params.context.base_id,
        MetaTable.FILTER_EXP,
        {
          xcCondition: (knex) =>
            knex.whereIn(
              'fk_row_color_condition_id',
              rowColorConditions.map((k) => k.id),
            ),
        },
      );

      for (const rowColorCondition of rowColorConditions.sort(
        (k, l) => k.nc_order - l.nc_order,
      )) {
        const filters = rawFilters.filter(
          (k) => k.fk_row_color_condition_id === rowColorCondition.id,
        );
        const nestedFilters = arrayToNested({
          data: filters,
          childAssignHandler: (filter, children) =>
            filter.children === children,
          getFkHandler: (filter) => filter.fk_parent_id,
          getIdHandler: (filter) => filter.id,
        });
        const condition: RowColoringInfoFilterRow = {
          id: rowColorCondition.id,
          color: rowColorCondition.color,
          nc_order: rowColorCondition.nc_order,
          is_set_as_background: rowColorCondition.is_set_as_background,
          conditions: filters,
          nestedConditions: nestedFilters,
        };
        (result as RowColoringInfoFilter).conditions.push(condition);
      }
      return result;
    } else {
      return null;
    }
  }

  async addRowColoringCondition(params: {
    context: NcContext;
    fk_view_id?: string;
    color: string;
    is_set_as_background: boolean;
    nc_order: number;
    filter?: FilterType;
    ncMeta?: MetaService;
  }) {
    const { context } = params;
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_ROW_COLOUR,
        context.workspace_id,
        ncMeta,
      ))
    ) {
      NcError.get(context).featureNotSupported({
        feature: PlanFeatureTypes.FEATURE_ROW_COLOUR,
        isOnPrem: isOnPrem,
      });
    }

    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.get(params.context).viewNotFound(params.fk_view_id);
      }
    } else {
      NcError.get(params.context).requiredFieldMissing('view_id');
    }
    if (
      view.row_coloring_mode &&
      view.row_coloring_mode !== ROW_COLORING_MODE.FILTER
    ) {
      NcError.get(params.context).invalidRequestBody(
        'Cannot directly change row coloring mode, remove it first',
      );
    }
    if (!params.color || !params.nc_order) {
      NcError.get(params.context).invalidRequestBody(
        'Invalid payload for row coloring condition',
      );
    }

    const ncMetaTrans = await ncMeta.startTransaction();

    try {
      const rowColoringCondition = await ncMetaTrans.metaInsert2(
        params.context.workspace_id,
        params.context.base_id,
        MetaTable.ROW_COLOR_CONDITIONS,
        {
          fk_view_id: view.id,
          fk_workspace_id: params.context.workspace_id,
          base_id: params.context.base_id,
          color: params.color,
          nc_order: params.nc_order,
          is_set_as_background: params.is_set_as_background ?? false,
        },
      );
      const rowColoringConditionId = rowColoringCondition.id;

      if (params.filter) {
        const filterToInsert = {
          ...extractProps(params.filter as any, [
            'comparison_op',
            'comparison_sub_op',
            'value',
            'fk_parent_id',
            'is_group',
            'logical_op',
            'base_id',
            'source_id',
            'order',
          ]),
          fk_row_color_condition_id: rowColoringConditionId,
        } as Filter;

        await ncMetaTrans.metaInsert2(
          params.context.workspace_id,
          params.context.base_id,
          MetaTable.FILTER_EXP,
          filterToInsert,
        );
      }

      if (!view.row_coloring_mode) {
        await View.update(
          params.context,
          view.id,
          {
            row_coloring_mode: ROW_COLORING_MODE.FILTER,
          },
          false,
          ncMeta,
        );
      }

      await ncMetaTrans.commit();

      return {
        id: rowColoringCondition.id,
        info: await this.getByViewId({ ...params }),
      };
    } catch (e) {
      await ncMetaTrans.rollback(e);
      throw e;
    }
  }

  async updateRowColoringCondition(params: {
    context: NcContext;
    fk_view_id?: string;
    fk_row_coloring_conditions_id: string;
    color: string;
    is_set_as_background: boolean;
    nc_order: number;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.get(params.context).viewNotFound(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }
    if (
      view.row_coloring_mode &&
      view.row_coloring_mode !== ROW_COLORING_MODE.FILTER
    ) {
      NcError.badRequest(
        'Cannot directly change row coloring mode, remove it first',
      );
    }

    const rowColorCondition = await ncMeta.metaUpdate(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        fk_workspace_id: params.context.workspace_id,
        base_id: params.context.base_id,
        color: params.color,
        nc_order: params.nc_order,
        is_set_as_background: params.is_set_as_background,
      },
      params.fk_row_coloring_conditions_id,
    );
    return rowColorCondition;
  }

  async deleteRowColoringCondition(params: {
    context: NcContext;
    fk_view_id?: string;
    fk_row_coloring_conditions_id: string;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    const exists = await ncMeta.metaGet2(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        id: params.fk_row_coloring_conditions_id,
      },
    );
    if (!exists) {
      NcError.notFound(
        `Row color condition with id ${params.fk_row_coloring_conditions_id} does not exists`,
      );
    }
    if (params.fk_view_id && params.fk_view_id !== exists.fk_view_id) {
      NcError.notFound(
        `Row color condition with id ${params.fk_row_coloring_conditions_id} does not exists`,
      );
    }

    const view = await View.get(params.context, exists.fk_view_id);

    if (!view) {
      NcError.get(params.context).viewNotFound(params.fk_view_id);
    }

    await RowColorCondition.delete(
      params.context,
      params.fk_row_coloring_conditions_id,
      params.ncMeta,
    );
  }

  async setRowColoringSelect(params: {
    context: NcContext;
    fk_view_id?: string;
    fk_column_id: string;
    is_set_as_background: boolean;
    ncMeta?: MetaService;
  }) {
    const { context, ncMeta } = params;

    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_ROW_COLOUR,
        context.workspace_id,
        ncMeta,
      ))
    ) {
      NcError.get(context).featureNotSupported({
        feature: PlanFeatureTypes.FEATURE_ROW_COLOUR,
        isOnPrem: isOnPrem,
      });
    }
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.get(params.context).viewNotFound(params.fk_view_id);
      }
    } else {
      NcError.get(context).requiredFieldMissing('view_id');
    }
    if (!params.fk_column_id) {
      NcError.get(context).requiredFieldMissing('fk_column_id');
    } else {
      const columns = await view.getColumns(context);
      if (!columns.find((col) => col.fk_column_id === params.fk_column_id)) {
        NcError.get(context).fieldNotFound(params.fk_column_id);
      }
    }

    const viewMeta: ViewMetaRowColoring = parseProp(view.meta);
    viewMeta.rowColoringInfo = {
      fk_column_id: params.fk_column_id,
      is_set_as_background: params.is_set_as_background ?? false,
    };

    await View.update(
      params.context,
      view.id,
      {
        row_coloring_mode: ROW_COLORING_MODE.SELECT,
        meta: viewMeta,
      },
      false,
      ncMeta,
    );
  }

  async removeRowColorInfo(params: {
    context: NcContext;
    fk_view_id?: string;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.get(params.context).viewNotFound(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    if (view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
      const rowColorConditions = await RowColorCondition.getByViewId(
        params.context,
        view.id,
      );

      const ncMetaTrans = await ncMeta.startTransaction();

      try {
        for (const rowColorCondition of rowColorConditions) {
          await ncMetaTrans.metaDelete(
            params.context.workspace_id,
            params.context.base_id,
            MetaTable.FILTER_EXP,
            {
              fk_row_color_condition_id: rowColorCondition.id,
            },
          );
          await ncMetaTrans.metaDelete(
            params.context.workspace_id,
            params.context.base_id,
            MetaTable.ROW_COLOR_CONDITIONS,
            rowColorCondition.id,
          );
        }

        await View.update(
          params.context,
          view.id,
          {
            row_coloring_mode: null,
          },
          false,
          ncMeta,
        );

        await ncMetaTrans.commit();
      } catch (e) {
        await ncMetaTrans.rollback(e);
        throw e;
      }
    } else if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const viewMeta = parseProp(view.meta);
      delete viewMeta.rowColoringInfo;

      await View.update(
        params.context,
        view.id,
        {
          row_coloring_mode: null,
          meta: viewMeta,
        },
        false,
        ncMeta,
      );
    }
  }

  async checkIfColumnInvolved(param: {
    context: NcContext;
    existingColumn: Column;
    newColumn?: Column | ColumnReqType;
    action: 'delete' | 'update';
    ncMeta?: MetaService;
  }) {
    const { context, existingColumn, newColumn, action } = param;
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    const commitHandlers: (() => Promise<void>)[] = [];

    if (
      existingColumn.uidt === UITypes.SingleSelect &&
      (action === 'delete' ||
        (action === 'update' && newColumn?.uidt !== UITypes.SingleSelect))
    ) {
      // remove row coloring select from view
      const views = await View.list(context, existingColumn.fk_model_id);
      for (const view of views) {
        if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
          const metaRowColoring: ViewMetaRowColoring =
            parseProp(view.meta) ?? {};
          if (
            metaRowColoring.rowColoringInfo.fk_column_id === existingColumn.id
          ) {
            commitHandlers.push(() =>
              this.removeRowColorInfo({
                context,
                fk_view_id: view.id,
              }),
            );
          }
        }
      }
    }

    if (action === 'delete') {
      const inConditions = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          xcCondition: (qb) => {
            qb.where('fk_column_id', existingColumn.id).whereNotNull(
              'fk_row_color_condition_id',
            );
          },
        },
      );

      if ((inConditions?.length ?? 0) > 0) {
        // get unique affectedRowColorConditionIds
        const affectedRowColorConditionIds = [
          ...new Set(inConditions.map((flt) => flt.fk_row_color_condition_id)),
        ];
        const affectedFilters = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          {
            xcCondition: (qb) => {
              qb.whereIn(
                'fk_row_color_condition_id',
                affectedRowColorConditionIds,
              );
            },
          },
        );
        for (const affectedRowColorConditionId of affectedRowColorConditionIds) {
          console.log(
            'affectedFilters.some',
            affectedFilters.filter(
              (flt) =>
                flt.fk_column_id !== existingColumn.id &&
                flt.fk_row_color_condition_id === affectedRowColorConditionId,
            ),
          );
          // if not has other filters, remove the row coloring condition
          if (
            !affectedFilters.some(
              (flt) =>
                flt.fk_column_id !== existingColumn.id &&
                flt.fk_row_color_condition_id === affectedRowColorConditionId,
            )
          ) {
            commitHandlers.push(() =>
              this.deleteRowColoringCondition({
                context,
                fk_row_coloring_conditions_id: affectedRowColorConditionId,
                ncMeta,
              }),
            );
            const rowColorCondition = await RowColorCondition.getById(
              context,
              affectedRowColorConditionId,
            );
            const rowColoringConditionsFromView =
              await RowColorCondition.getByViewId(
                context,
                rowColorCondition.fk_view_id,
              );
            if (
              !rowColoringConditionsFromView.some(
                (rowColor) => rowColor.id !== rowColorCondition.id,
              )
            ) {
              // if not has other condition, remove the row coloring setting altogether
              commitHandlers.push(() =>
                this.removeRowColorInfo({
                  context,
                  fk_view_id: rowColorCondition.fk_view_id,
                  ncMeta,
                }),
              );
            }
          }
        }
      }
    }

    return {
      applyRowColorInvolvement: async () => {
        Promise.all(commitHandlers.map((k) => k()));
      },
    };
  }
}
