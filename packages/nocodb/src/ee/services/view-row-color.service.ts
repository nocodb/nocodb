import { Injectable } from '@nestjs/common';
import { parseProp, ROW_COLORING_MODE } from 'nocodb-sdk';
import { ViewRowColorService as ViewRowColorServiceCE } from 'src/services/view-row-color.service';
import type { MetaService } from '~/meta/meta.service';
import type { Filter, SelectOption } from '~/models';
import type { ViewMetaRowColoring } from '~/models/View';
import type {
  FilterType,
  NcContext,
  RowColoringInfo,
  RowColoringInfoFilter,
  RowColoringInfoFilterRow,
} from 'nocodb-sdk';
import { MetaTable } from '~/cli';
import { NcError } from '~/helpers/catchError';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import { View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';
import { arrayToNested } from '~/utils/recursive.utils';

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
        NcError.viewNotFoundV3(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const baseModel = await getBaseModelSqlFromModelId({
        context: params.context,
        modelId: view.fk_model_id,
      });
      await baseModel.model.getColumns(params.context);
      const meta: ViewMetaRowColoring = parseProp(view.meta);
      const selectColumn = baseModel.model.columns.find(
        (k) => k.id === meta.rowColoringInfo.fk_column_id,
      );
      const selectOptions = await selectColumn.getColOptions<SelectOption>(
        params.context,
      );

      return {
        options: (selectOptions as any).options,
        mode: ROW_COLORING_MODE.SELECT,
        is_set_as_background: meta.rowColoringInfo.is_set_as_background,
        fk_column_id: meta.rowColoringInfo.fk_column_id,
        selectColumn,
        fk_model_id: baseModel.model.id,
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
              'fk_row_color_conditions_id',
              rowColorConditions.map((k) => k.id),
            ),
        },
      );

      for (const rowColorCondition of rowColorConditions.sort(
        (k, l) => k.nc_order - l.nc_order,
      )) {
        const filters = rawFilters.filter(
          (k) => k.fk_row_color_conditions_id === rowColorCondition.id,
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
    filter: FilterType;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.viewNotFoundV3(params.fk_view_id);
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

    await ncMeta.startTransaction();
    const rowColoringCondition = await ncMeta.metaInsert2(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        fk_view_id: view.id,
        fk_workspace_id: params.context.workspace_id,
        base_id: params.context.base_id,
        color: params.color,
        nc_order: params.nc_order,
        is_set_as_background: params.is_set_as_background,
      },
    );
    const rowColoringConditionId = rowColoringCondition.id;
    const filterToInsert = {
      ...params.filter,
      fk_row_color_conditions_id: rowColoringConditionId,
    } as Filter;

    const filterInsertResult = await ncMeta.metaInsert2(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.FILTER_EXP,
      filterToInsert,
    );

    if (!view.row_coloring_mode) {
      await ncMeta.metaUpdate(
        params.context.workspace_id,
        params.context.base_id,
        MetaTable.VIEWS,
        {
          row_coloring_mode: ROW_COLORING_MODE.FILTER,
        },
        view.id,
      );
    }
    await ncMeta.commit();

    return {
      mode: ROW_COLORING_MODE.FILTER,
      fk_model_id: view.fk_model_id,
      fk_view_id: view.id,
      conditions: [
        {
          id: rowColoringCondition.id,
          nc_order: rowColoringCondition.nc_order,
          is_set_as_background: rowColoringCondition.is_set_as_background,
          color: rowColoringCondition.color,
          conditions: [filterInsertResult],
          nestedConditions: [filterInsertResult],
        },
      ],
    } as RowColoringInfo;
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
        NcError.viewNotFoundV3(params.fk_view_id);
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
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.viewNotFoundV3(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    // TODO: validation for record existance
    await ncMeta.metaDelete(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        fk_view_id: view.id,
        id: params.fk_row_coloring_conditions_id,
      },
    );
  }

  async setRowColoringSelect(params: {
    context: NcContext;
    fk_view_id?: string;
    color: string;
    fk_column_id: string;
    is_set_as_background: boolean;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      if (!view) {
        NcError.viewNotFoundV3(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    const viewMeta: ViewMetaRowColoring = parseProp(view.meta);
    viewMeta.rowColoringInfo = {
      fk_column_id: params.fk_column_id,
      is_set_as_background: params.is_set_as_background,
    };
    await ncMeta.metaUpdate(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.VIEWS,
      {
        meta: viewMeta,
        row_coloring_mode: ROW_COLORING_MODE.SELECT,
      },
      view.id,
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
        NcError.viewNotFoundV3(params.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    if (view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
    } else if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const viewMeta = parseProp(view.meta);
      delete viewMeta.rowColoringInfo;
      await ncMeta.metaUpdate(
        params.context.workspace_id,
        params.context.base_id,
        MetaTable.VIEWS,
        {
          row_coloring_mode: null,
          meta: viewMeta,
        },
        view.id,
      );
      const rowColorConditions = await RowColorCondition.getByViewId(
        params.context,
        view.id,
      );
      await ncMeta.startTransaction();
      for (const rowColorCondition of rowColorConditions) {
        await ncMeta.metaDelete(
          params.context.workspace_id,
          params.context.base_id,
          MetaTable.FILTER_EXP,
          {
            fk_row_color_conditions_id: rowColorCondition.id,
          },
        );
        await ncMeta.metaDelete(
          params.context.workspace_id,
          params.context.base_id,
          MetaTable.ROW_COLOR_CONDITIONS,
          rowColorCondition.id,
        );
      }
      await ncMeta.metaUpdate(
        params.context.workspace_id,
        params.context.base_id,
        MetaTable.VIEWS,
        {
          row_coloring_mode: null,
        },
        view.id,
      );
      await ncMeta.commit();
    }
  }
}
