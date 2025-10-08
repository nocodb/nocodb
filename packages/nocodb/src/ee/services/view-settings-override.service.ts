import { Injectable } from '@nestjs/common';
import {
  extractSupportedViewSettingOverrideOptions,
  ViewTypes,
} from 'nocodb-sdk';
import { PlanFeatureTypes, ViewSettingOverrideOptions } from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { withoutId } from '~/helpers/exportImportHelpers';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { ViewRowColorV3Service } from '~/services/v3/view-row-color-v3.service';
import { checkForFeature } from '~/helpers/paymentHelpers';
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
      settingToOverride: ViewSettingOverrideOptions[];
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    await checkForFeature(
      context,
      PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER,
    );
    const sourceView = await View.get(context, param.sourceViewId, ncMeta);
    if (!sourceView) {
      NcError.get(context).viewNotFound(param.sourceViewId);
    }
    const destView = await View.get(context, param.destinationViewId, ncMeta);
    if (!destView) {
      NcError.get(context).viewNotFound(param.destinationViewId);
    }
    const settingToOverride = extractSupportedViewSettingOverrideOptions(
      param.settingToOverride,
      sourceView.type,
      destView.type,
    );
    if (!settingToOverride.length) {
      NcError.get(context).invalidRequestBody(`No setting to override`);
    }

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
      await trxNcMeta.rollback();
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
      settingToOverride: ViewSettingOverrideOptions[];
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const inSettingToOverride = (setting: ViewSettingOverrideOptions) => {
      return settingToOverride.includes(setting);
    };
    // #region update view columns
    if (
      inSettingToOverride(ViewSettingOverrideOptions.FIELD_ORDER) ||
      inSettingToOverride(ViewSettingOverrideOptions.FIELD_VISIBILITY) ||
      inSettingToOverride(ViewSettingOverrideOptions.GROUP) ||
      inSettingToOverride(ViewSettingOverrideOptions.COLUMN_WIDTH)
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
          if (inSettingToOverride(ViewSettingOverrideOptions.FIELD_ORDER)) {
            destColumn.order = sourceColumn.order;
          }
          if (
            inSettingToOverride(ViewSettingOverrideOptions.FIELD_VISIBILITY)
          ) {
            destColumn.show = sourceColumn.show;
          }
          if (inSettingToOverride(ViewSettingOverrideOptions.COLUMN_WIDTH)) {
            (destColumn as GridViewColumn).width = (
              sourceColumn as GridViewColumn
            ).width;
          }
          if (inSettingToOverride(ViewSettingOverrideOptions.GROUP)) {
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
    if (inSettingToOverride(ViewSettingOverrideOptions.ROW_HEIGHT)) {
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
      inSettingToOverride(ViewSettingOverrideOptions.SORT) ||
      inSettingToOverride(ViewSettingOverrideOptions.FILTER_CONDITION) ||
      inSettingToOverride(ViewSettingOverrideOptions.ROW_COLORING)
    ) {
      const sourceV3View = await this.viewsV3Service.getView(
        context,
        { viewId: sourceView.id, req },
        ncMeta,
      );
      // #region update view sort
      if (inSettingToOverride(ViewSettingOverrideOptions.SORT)) {
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
      if (inSettingToOverride(ViewSettingOverrideOptions.FILTER_CONDITION)) {
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
      if (inSettingToOverride(ViewSettingOverrideOptions.ROW_COLORING)) {
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
}
