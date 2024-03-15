import ViewCE from 'src/models/View';
import CalendarRange from './CalendarRange';
import type { ViewType } from 'nocodb-sdk';
import type FormView from '~/models/FormView';
import type GridView from '~/models/GridView';
import type KanbanView from '~/models/KanbanView';
import type GalleryView from '~/models/GalleryView';
import type { MetaService } from '~/meta/meta.service';
import type MapView from '~/models/MapView';
import Noco from '~/Noco';
import Model from '~/models/Model';
import { NcError } from '~/helpers/catchError';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

export default class View extends ViewCE implements ViewType {
  static async insert(
    view: Partial<View> &
      Partial<FormView | GridView | GalleryView | KanbanView | MapView> & {
        copy_from_id?: string;
        fk_grp_col_id?: string;
      },
    ncMeta = Noco.ncMeta,
  ) {
    const model = await Model.get(view.fk_model_id);

    if (!model) {
      NcError.tableNotFound(view.fk_model_id);
    }

    const workspaceId = await getWorkspaceForBase(model.base_id);

    const viewsInTable = await Noco.ncMeta.metaCount(
      null,
      null,
      MetaTable.VIEWS,
      {
        condition: {
          fk_model_id: model.id,
        },
      },
    );

    const viewLimitForWorkspace = await getLimit(
      PlanLimitTypes.VIEW_LIMIT,
      workspaceId,
    );

    if (viewsInTable >= viewLimitForWorkspace) {
      NcError.badRequest(
        `Only ${viewLimitForWorkspace} views are allowed, for more please upgrade your plan`,
      );
    }

    return super.insert(view, ncMeta);
  }

  static async getRangeColumnsAsArray(viewId: string, ncMeta: MetaService) {
    const calRange = await CalendarRange.read(viewId, ncMeta);
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
}
