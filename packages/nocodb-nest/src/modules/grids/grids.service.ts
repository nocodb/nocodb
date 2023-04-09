import { Injectable } from '@nestjs/common';
import { GridUpdateReqType, ViewCreateReqType, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { GridView, View } from '../../models';
import { T } from 'nc-help';

@Injectable()
export class GridsService {
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

    T.emit('evt', { evt_type: 'vtable:created', show_as: 'grid' });

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
