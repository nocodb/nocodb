import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk'
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError'
import { GridView, View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type {
  GridUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import { AppHooksService } from './app-hooks/app-hooks.service'

@Injectable()
export class GridsService {

  constructor(private readonly appHooksService: AppHooksService) {
  }

  async gridViewCreate(param: { tableId: string; grid: ViewCreateReqType }) {
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

    // T.emit('evt', { evt_type: 'vtable:created', show_as: 'grid' });


    this.appHooksService.emit(AppEvents.VIEW_CREATE,{
      view,
      showAs: 'grid',
    })

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      user: param.user,
      view,
    });

    return view;
  }

  async gridViewUpdate(param: { viewId: string; grid: GridUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/GridUpdateReq',
      param.grid,
    );

    const view = await View.get(param.viewId);

    if(!view) {
      NcError.badRequest('View not found')
    }

    // T.emit('evt', { evt_type: 'view:updated', type: 'grid' });
    const res = await GridView.update(param.viewId, param.grid);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE,{
      view,
      showAs: 'map',
    })

    return res;
  }
}
