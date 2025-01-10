import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type { MapUpdateReqType, UserType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { MapView, Model, User, View } from '~/models';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class MapsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async mapViewGet(context: NcContext, param: { mapViewId: string }) {
    return await MapView.get(context, param.mapViewId);
  }

  async mapViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      map: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.map,
    );

    const model = await Model.get(context, param.tableId);

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.map,
        // todo: sanitize
        fk_model_id: param.tableId,
        type: ViewTypes.MAP,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.user?.id,
      },
      model,
      req: param.req,
    });

    // populate  cache and add to list since the list cache already exist
    const view = await View.get(context, id);
    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    const owner = param.req.user;

    this.appHooksService.emit(AppEvents.MAP_CREATE, {
      view,
      req: param.req,
      owner,
      context,
    });

    return view;
  }

  async mapViewUpdate(
    context: NcContext,
    param: {
      mapViewId: string;
      map: MapUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/MapUpdateReq', param.map);

    const view = await View.get(context, param.mapViewId);

    if (!view) {
      NcError.viewNotFound(param.mapViewId);
    }

    const res = await MapView.update(context, param.mapViewId, param.map);

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.MAP_UPDATE, {
      view: { ...view, ...param.map },
      oldView: view,
      req: param.req,
      context,
      owner,
    });

    return res;
  }
}
