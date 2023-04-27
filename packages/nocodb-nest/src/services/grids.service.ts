import { Injectable } from '@nestjs/common';
import {UserType, ViewTypes, AppEvents} from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { GridView, View } from '../models';
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { AppHooksService} from "./app-hooks/app-hooks.service";

@Injectable()
export class GridsService {

  constructor(private appHooksService: AppHooksService) {
  }


  async gridViewCreate(param: { tableId: string; grid: ViewCreateReqType; user: UserType }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.grid,
    );

    const view = await View.insert({
      ...param.grid,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.GRID,
    });

    T.emit('evt', { evt_type: 'vtable:created', show_as: 'grid' });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      user: param.user,
      view,
    })

    return view;
  }

  async gridViewUpdate(param: { viewId: string; grid: GridUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/GridUpdateReq',
      param.grid,
    );
    T.emit('evt', { evt_type: 'view:updated', type: 'grid' });
    return await GridView.update(param.viewId, param.grid);
  }
}
