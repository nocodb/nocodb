import ViewCE from 'src/models/View';
import { ExpandedFormMode, type ExpandedFormModeType } from 'nocodb-sdk';
import CalendarRange from './CalendarRange';
import type { NcRequest, ViewType } from 'nocodb-sdk';
import type FormView from '~/models/FormView';
import type GridView from '~/models/GridView';
import type KanbanView from '~/models/KanbanView';
import type GalleryView from '~/models/GalleryView';
import type { MetaService } from '~/meta/meta.service';
import type MapView from '~/models/MapView';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import Model from '~/models/Model';
import { NcError } from '~/helpers/catchError';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';

export default class View extends ViewCE implements ViewType {
  expanded_record_mode?: ExpandedFormModeType;
  attachment_mode_column_id?: string;

  static async insert(
    context: NcContext,
    {
      req,
      view,
    }: {
      view: Partial<View> &
        Partial<FormView | GridView | GalleryView | KanbanView | MapView> & {
          copy_from_id?: string;
          fk_grp_col_id?: string;
        };
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const model = await Model.get(context, view.fk_model_id);

    if (!model) {
      NcError.tableNotFound(view.fk_model_id);
    }

    const viewsInTable = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      {
        condition: {
          fk_model_id: model.id,
        },
      },
    );

    const viewLimitForWorkspace = await getLimit(
      PlanLimitTypes.LIMIT_VIEW_PER_TABLE,
      model.fk_workspace_id,
    );

    if (viewsInTable >= viewLimitForWorkspace) {
      NcError.badRequest(
        `Only ${viewLimitForWorkspace} views are allowed, for more please upgrade your plan`,
      );
    }

    return super.insert(context, { view, req }, ncMeta);
  }

  static async getRangeColumnsAsArray(
    context: NcContext,
    viewId: string,
    ncMeta: MetaService,
  ) {
    const calRange = await CalendarRange.read(context, viewId, ncMeta);
    if (calRange) {
      const calIds: Set<string> = new Set();
      calRange.ranges.forEach((range: any) => {
        calIds.add(range.fk_from_column_id);
        if (!range.fk_to_column_id) return;
        calIds.add(range.fk_to_column_id);
      });
      return Array.from(calIds) as Array<string>;
    }
    return [];
  }

  static async updateIfColumnUsedAsExpandedMode(
    context: NcContext,
    columnId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const views = await this.list(context, modelId, ncMeta);

    if (!views.length) return;

    for (const view of views) {
      if ((view as any)?.attachment_mode_column_id === columnId) {
        await View.update(context, view.id, {
          ...view,
          expanded_record_mode: ExpandedFormMode.FIELD,
          attachment_mode_column_id: null,
        });
      }
    }
  }
}
