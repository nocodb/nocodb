import { Injectable } from '@nestjs/common';
import { SharedViewReqType, ViewUpdateReqType } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { Model, View } from '../../models'
import { T } from 'nc-help';
import { TablesService } from '../tables/tables.service';

@Injectable()
export class ViewsService {
  constructor(private tablesService: TablesService) {}

  async viewList(param: {
    tableId: string;
    user: {
      roles: Record<string, boolean>;
    };
  }) {
    const model = await Model.get(param.tableId);

    const viewList = await this.tablesService.xcVisibilityMetaGet({
      projectId: model.project_id,
      models: [model],
    });

    // todo: user roles
    //await View.list(param.tableId)
    const filteredViewList = viewList.filter((view: any) => {
      return Object.keys(param?.user?.roles).some(
        (role) => param?.user?.roles[role] && !view.disabled[role],
      );
    });

    return filteredViewList;
  }

  async shareView(param: { viewId: string }) {
    T.emit('evt', { evt_type: 'sharedView:generated-link' });
    return await View.share(param.viewId);
  }

  async viewUpdate(param: { viewId: string; view: ViewUpdateReqType }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewUpdateReq',
      param.view,
    );
    const result = await View.update(param.viewId, param.view);
    T.emit('evt', { evt_type: 'vtable:updated', show_as: result.type });
    return result;
  }

  async viewDelete(param: { viewId: string }) {
    await View.delete(param.viewId);
    T.emit('evt', { evt_type: 'vtable:deleted' });
    return true;
  }

  async shareViewUpdate(param: {
    viewId: string;
    sharedView: SharedViewReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/SharedViewReq',
      param.sharedView,
    );
    T.emit('evt', { evt_type: 'sharedView:updated' });
    return await View.update(param.viewId, param.sharedView);
  }

  async shareViewDelete(param: { viewId: string }) {
    T.emit('evt', { evt_type: 'sharedView:deleted' });
    await View.sharedViewDelete(param.viewId);
    return true;
  }

  async showAllColumns(param: { viewId: string; ignoreIds?: string[] }) {
    await View.showAllColumns(param.viewId, param.ignoreIds || []);
    return true;
  }

  async hideAllColumns(param: { viewId: string; ignoreIds?: string[] }) {
    await View.hideAllColumns(param.viewId, param.ignoreIds || []);
    return true;
  }

  async shareViewList(param: { tableId: string }) {
    return await View.shareViewList(param.tableId);
  }
}
