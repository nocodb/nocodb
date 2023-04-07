import { Injectable } from '@nestjs/common';
import { SharedViewReqType, ViewUpdateReqType } from 'nocodb-sdk';
import { validatePayload } from '../../helpers';
import { Model, ModelRoleVisibility, View } from '../../models'
import { T } from 'nc-help';
import { TablesService } from '../tables/tables.service';

// todo: move
 async function xcVisibilityMetaGet(param: {
  projectId: string;
  includeM2M?: boolean;
  models?: Model[];
}) {
  const { includeM2M = true, projectId, models: _models } = param ?? {};

  // todo: move to
  const roles = ['owner', 'creator', 'viewer', 'editor', 'commenter', 'guest'];

  const defaultDisabled = roles.reduce((o, r) => ({ ...o, [r]: false }), {});

  let models =
    _models ||
    (await Model.list({
      project_id: projectId,
      base_id: undefined,
    }));

  models = includeM2M ? models : (models.filter((t) => !t.mm) as Model[]);

  const result = await models.reduce(async (_obj, model) => {
    const obj = await _obj;

    const views = await model.getViews();
    for (const view of views) {
      obj[view.id] = {
        ptn: model.table_name,
        _ptn: model.title,
        ptype: model.type,
        tn: view.title,
        _tn: view.title,
        table_meta: model.meta,
        ...view,
        disabled: { ...defaultDisabled },
      };
    }

    return obj;
  }, Promise.resolve({}));

  const disabledList = await ModelRoleVisibility.list(projectId);

  for (const d of disabledList) {
    if (result[d.fk_view_id])
      result[d.fk_view_id].disabled[d.role] = !!d.disabled;
  }

  return Object.values(result);
}


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

    const viewList = await xcVisibilityMetaGet({
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
