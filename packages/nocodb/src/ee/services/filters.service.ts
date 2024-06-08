import { Injectable } from '@nestjs/common';
import { FiltersService as FiltersServiceCE } from 'src/services/filters.service';
import { AppEvents, isLinksOrLTAR } from 'nocodb-sdk';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Column, Filter, View } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

@Injectable()
export class FiltersService extends FiltersServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(context, param.viewId);

    if (!view) {
      NcError.viewNotFound(param.viewId);
    }

    const filtersInView = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: {
          _and: [
            {
              fk_view_id: {
                eq: view.id,
              },
            },
            {
              is_group: {
                eq: null,
              },
            },
          ],
        },
      },
    );

    const filterLimitForWorkspace = await getLimit(
      PlanLimitTypes.FILTER_LIMIT,
      context.workspace_id,
    );

    if (filtersInView >= filterLimitForWorkspace) {
      NcError.badRequest(
        `Only ${filterLimitForWorkspace} filters are allowed, for more please upgrade your plan`,
      );
    }

    return super.filterCreate(context, param);
  }

  async linkFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      columnId: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const column = await Column.get(context, param.columnId);

    if (!column && !isLinksOrLTAR(column)) {
      NcError.badRequest('Link column not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_link_col_id: param.columnId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      column,
      req: param.req,
    });
    return filter;
  }

  async linkFilterList(context: NcContext, param: { columnId: any }) {
    return Filter.rootFilterListByLink(context, { columnId: param.columnId });
  }
}
