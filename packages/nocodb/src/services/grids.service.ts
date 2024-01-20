import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Column, GridView, Model, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class GridsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async gridViewCreate(param: {
    tableId: string;
    grid: ViewCreateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.grid,
    );
    //
    // const view = await View.insert({
    //   ...param.grid,
    //   // todo: sanitize
    //   fk_model_id: param.tableId,
    //   type: ViewTypes.GRID,
    // });

    const model = await Model.get(param.tableId);

    const { id } = await View.insertMetaOnly(
      {
        ...param.grid,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.GRID,
        base_id: model.base_id,
        source_id: model.source_id,
      },
      model,
    );

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );
    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,

      showAs: 'grid',
      req: param.req,
    });

    return view;
  }

  async gridViewUpdate(param: {
    viewId: string;
    grid: GridUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/GridUpdateReq',
      param.grid,
    );

    const view = await View.get(param.viewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await GridView.update(param.viewId, param.grid);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'map',
      req: param.req,
    });

    return res;
  }
}
