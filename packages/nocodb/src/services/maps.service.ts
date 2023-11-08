import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type { MapUpdateReqType, UserType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { MapView, View } from '~/models';

@Injectable()
export class MapsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async mapViewGet(param: { mapViewId: string }) {
    return await MapView.get(param.mapViewId);
  }

  async mapViewCreate(param: {
    tableId: string;
    map: ViewCreateReqType;
    user: UserType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.map,
    );
    const view = await View.insert({
      ...param.map,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.MAP,
    });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'map',

      req: param.req,
    });

    return view;
  }

  async mapViewUpdate(param: {
    mapViewId: string;
    map: MapUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload('swagger.json#/components/schemas/MapUpdateReq', param.map);

    const view = await View.get(param.mapViewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await MapView.update(param.mapViewId, param.map);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'map',
      req: param.req,
    });

    return res;
  }
}
