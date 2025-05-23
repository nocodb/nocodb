import { Injectable } from '@nestjs/common';
import { parseProp, ROW_COLORING_MODE } from 'nocodb-sdk';
import { MetaTable } from 'src/cli';
import { NcError } from 'src/helpers/catchError';
import { getBaseModelSqlFromModelId } from 'src/helpers/dbHelpers';
import { View } from 'src/models';
import RowColorCondition from 'src/models/RowColorCondition';
import Noco from 'src/Noco';
import { arrayToNested } from 'src/utils/recursive.utils';
import type { MetaService } from 'src/meta/meta.service';
import type { SelectOption } from 'src/models';
import type { ViewMetaRowColoring } from 'src/models/View';
import type {
  NcContext,
  RowColoringInfo,
  RowColoringInfoFilter,
  RowColoringInfoFilterRow,
} from 'nocodb-sdk';

@Injectable()
export class ViewRowColorService {
  async getByViewId(params: {
    context: NcContext;
    fk_view_id?: string;
    view?: View;
    ncMeta?: MetaService;
  }) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (params.view) {
      view = params.view;
    } else if (params.fk_view_id) {
      view = await View.get(params.context, params.fk_view_id);
      console.log(view, params.fk_view_id);
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

      for (const rowColorCondition of rowColorConditions) {
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
          color: rowColorCondition.color,
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
}
