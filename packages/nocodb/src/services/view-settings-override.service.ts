import { Injectable } from '@nestjs/common';
import {
  ViewSettingOverrideOptionTexts,
  viewTypeAlias,
  ViewTypes,
} from 'nocodb-sdk';
import type { NcRequest, ViewSettingOverrideOptions } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { withoutId } from '~/helpers/exportImportHelpers';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { ViewRowColorV3Service } from '~/services/v3/view-row-color-v3.service';
import { NcError } from '~/helpers/catchError';
import {
  CalendarViewColumn,
  FormViewColumn,
  GalleryViewColumn,
  GridView,
  GridViewColumn,
  KanbanViewColumn,
  Sort,
  View,
} from '~/models';
import Noco from '~/Noco';
import {
  type OverrideViewCalendarSetting,
  type OverrideViewFormSetting,
  type OverrideViewGallerySetting,
  type OverrideViewGridSetting,
  type OverrideViewKanbanSetting,
  viewOverrideAvailableSettings,
} from '~/types/view-setting-override/settings';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { ViewsV3Service } from '~/services/v3/views-v3.service';

@Injectable()
export class ViewSettingsOverrideService {
  constructor(
    protected readonly viewsV3Service: ViewsV3Service,
    protected readonly sortsV3Service: SortsV3Service,
    protected readonly filtersV3Service: FiltersV3Service,
    protected readonly viewRowColorV3Service: ViewRowColorV3Service,
  ) {}

  async overrideViewSetting(
    context: NcContext,
    param: {
      sourceViewId: string;
      destinationViewId: string;
      settingToOverride:
        | OverrideViewGridSetting
        | OverrideViewKanbanSetting
        | OverrideViewCalendarSetting
        | OverrideViewGallerySetting
        | OverrideViewFormSetting;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const sourceView = await View.get(context, param.sourceViewId, ncMeta);
    if (!sourceView) {
      NcError.get(context).viewNotFound(param.sourceViewId);
    }
    const destView = await View.get(context, param.destinationViewId, ncMeta);
    if (!destView) {
      NcError.get(context).viewNotFound(param.destinationViewId);
    }
    if (
      !param.settingToOverride ||
      !Object.keys(param.settingToOverride).length ||
      !Object.values(param.settingToOverride).some(
        (setting) => setting === true,
      )
    ) {
      NcError.get(context).invalidRequestBody(`No settings to override`);
    }
    const settingToOverride = this.validateOverrideSetting(context, {
      sourceView,
      destinationView: destView,
      settingToOverride: param.settingToOverride,
    });

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            destView.fk_model_id,
          )
        ).withViewId(destView.id)
      ).forUpdate();

    const trxNcMeta = await ncMeta.startTransaction();
    try {
      const result = await this._performOverrideViewSetting(
        context,
        {
          sourceView,
          destinationView: destView,
          settingToOverride: settingToOverride,
          req: param.req,
        },
        trxNcMeta,
      );
      await trxNcMeta.commit();

      if (!param.viewWebhookManager) {
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId());
        viewWebhookManager.emit();
      }
      return result;
    } catch (ex) {
      trxNcMeta.rollback();
      throw ex;
    }
  }

  async _performOverrideViewSetting(
    context: NcContext,
    {
      sourceView,
      destinationView,
      settingToOverride,
      req,
      viewWebhookManager,
    }: {
      sourceView: View;
      destinationView: View;
      req: NcRequest;
      settingToOverride: { [K in ViewSettingOverrideOptions]?: boolean };
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // #region update view columns
    if (
      settingToOverride.fieldOrder ||
      settingToOverride.fieldVisibility ||
      settingToOverride.group ||
      settingToOverride.columnWidth
    ) {
      const destColumns = await this.getViewColumns(
        context,
        { view: destinationView },
        ncMeta,
      );
      const sourceColumns = await this.getViewColumns(
        context,
        { view: sourceView },
        ncMeta,
      );

      for (const destColumn of destColumns) {
        const sourceColumn = sourceColumns.find(
          (col) => destColumn.fk_column_id === col.fk_column_id,
        );
        if (sourceColumn) {
          if (settingToOverride.fieldOrder) {
            destColumn.order = sourceColumn.order;
          }
          if (settingToOverride.fieldVisibility) {
            destColumn.show = sourceColumn.show;
          }
          if (settingToOverride.columnWidth) {
            (destColumn as GridViewColumn).width = (
              sourceColumn as GridViewColumn
            ).width;
          }
          if (settingToOverride.group) {
            (destColumn as GridViewColumn).aggregation = (
              sourceColumn as GridViewColumn
            ).aggregation;
            (destColumn as GridViewColumn).group_by = (
              sourceColumn as GridViewColumn
            ).group_by;
            (destColumn as GridViewColumn).group_by_order = (
              sourceColumn as GridViewColumn
            ).group_by_order;
            (destColumn as GridViewColumn).group_by_sort = (
              sourceColumn as GridViewColumn
            ).group_by_sort;
          }
        }
        await this.updateViewColumn(
          context,
          { view: destinationView, column: destColumn },
          ncMeta,
        );
      }
    }
    // #endregion update view columns

    // #region update view row height
    if (settingToOverride.rowHeight) {
      const destGridView = await destinationView.getView<GridView>(
        context,
        ncMeta,
      );
      const sourceGridView = await sourceView.getView<GridView>(
        context,
        ncMeta,
      );
      destGridView.row_height = sourceGridView.row_height;
      await GridView.update(context, destinationView.id, destGridView, ncMeta);
    }
    // #endregion update view row height

    if (
      settingToOverride.sort ||
      settingToOverride.filterCondition ||
      settingToOverride.rowColoring
    ) {
      const sourceV3View = await this.viewsV3Service.getView(
        context,
        { viewId: sourceView.id, req },
        ncMeta,
      );
      // #region update view sort
      if (settingToOverride.sort) {
        // skip viewWebhookManager for this, Sort.deleteAll is not a standalone operation, it's invoked by view service
        await Sort.deleteAll(context, destinationView.id, ncMeta);
        for (const sort of sourceV3View.sorts ?? []) {
          await this.sortsV3Service.sortCreate(
            context,
            {
              viewId: destinationView.id,
              req,
              sort: withoutId(sort),
              viewWebhookManager,
            },
            ncMeta,
          );
        }
      }
      // #endregion update view sort
      if (settingToOverride.filterCondition) {
        await this.filtersV3Service.filterDeleteAll(
          context,
          { viewId: destinationView.id },
          ncMeta,
        );
        if (sourceV3View.filters) {
          const insertPayload = {
            ...sourceV3View.filters,
            filters: this.filtersV3Service.withoutId(
              sourceV3View.filters.filters,
            ),
          };
          console.log('insert', insertPayload);
          await this.filtersV3Service.insertFilterGroup({
            context,
            param: {
              viewId: destinationView.id,
            },
            groupOrFilter: insertPayload,
            viewId: destinationView.id,
            viewWebhookManager,
            ncMeta,
          });
        }
      }
      // #region update row coloring
      if (settingToOverride.rowColoring) {
        await this.viewRowColorV3Service.replace(
          context,
          {
            viewId: destinationView.id,
            req,
            body: sourceV3View.row_coloring,
            viewWebhookManager,
          },
          ncMeta,
        );
      }
    }
    // #endregion update row coloring
  }

  async getViewColumns(
    context: NcContext,
    {
      view,
    }: {
      view: View;
    },
    ncMeta = Noco.ncMeta,
  ) {
    switch (view.type) {
      case ViewTypes.GRID: {
        return GridViewColumn.list(context, view.id, ncMeta);
      }
      case ViewTypes.KANBAN: {
        return KanbanViewColumn.list(context, view.id, ncMeta);
      }
      case ViewTypes.CALENDAR: {
        return CalendarViewColumn.list(context, view.id, ncMeta);
      }
      case ViewTypes.GALLERY: {
        return GalleryViewColumn.list(context, view.id, ncMeta);
      }
      case ViewTypes.FORM: {
        return FormViewColumn.list(context, view.id, ncMeta);
      }
    }
  }

  async updateViewColumn(
    context: NcContext,
    {
      view,
      column,
    }: {
      view: View;
      column:
        | GridViewColumn
        | KanbanViewColumn
        | CalendarViewColumn
        | GalleryViewColumn
        | FormViewColumn;
    },
    ncMeta = Noco.ncMeta,
  ) {
    switch (view.type) {
      case ViewTypes.GRID: {
        return await GridViewColumn.update(context, column.id, column, ncMeta);
      }
      case ViewTypes.KANBAN: {
        return await KanbanViewColumn.update(
          context,
          column.id,
          column,
          ncMeta,
        );
      }
      case ViewTypes.CALENDAR: {
        return await CalendarViewColumn.update(
          context,
          column.id,
          column,
          ncMeta,
        );
      }
      case ViewTypes.GALLERY: {
        return await GalleryViewColumn.update(
          context,
          column.id,
          column,
          ncMeta,
        );
      }
      case ViewTypes.FORM: {
        return await FormViewColumn.update(context, column.id, column, ncMeta);
      }
    }
  }

  validateOverrideSetting(
    context: NcContext,
    {
      sourceView,
      destinationView,
      settingToOverride,
    }: {
      sourceView: View;
      destinationView: View;
      settingToOverride:
        | OverrideViewGridSetting
        | OverrideViewKanbanSetting
        | OverrideViewCalendarSetting
        | OverrideViewGallerySetting
        | OverrideViewFormSetting;
    },
  ) {
    const result: { [K in ViewSettingOverrideOptions]?: boolean } = {};
    for (const setting of Object.keys(settingToOverride)) {
      if (settingToOverride[setting]) {
        if (
          !viewOverrideAvailableSettings[sourceView.type].some(
            (typeSetting) => typeSetting === setting,
          )
        ) {
          NcError.get(context).invalidRequestBody(
            `Setting ${
              ViewSettingOverrideOptionTexts[setting]
            } is invalid for view type [${viewTypeAlias[sourceView.type]}]`,
          );
        } else if (
          !viewOverrideAvailableSettings[destinationView.type].some(
            (typeSetting) => typeSetting === setting,
          )
        ) {
          NcError.get(context).invalidRequestBody(
            `Setting ${
              ViewSettingOverrideOptionTexts[setting]
            } is invalid for view type [${
              viewTypeAlias[destinationView.type]
            }]`,
          );
        }
        result[setting] = true;
      }
    }
    return result;
  }
}
