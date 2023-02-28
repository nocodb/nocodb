import { Model, View } from '../models';
import { Tele } from 'nc-help';
import { SharedViewReqType, ViewReqType } from 'nocodb-sdk';
import { xcVisibilityMetaGet } from '../meta/api/modelVisibilityApis';


export async function viewList(param: {
  tableId: string;
  user: {
    roles: Record<string, boolean>;
  };
}) {
  const model = await Model.get(param.tableId);

  const viewList = await xcVisibilityMetaGet(
    // param.projectId,
    // param.baseId,
    model.project_id,
    [model]
  );

  // todo: user roles
  //await View.list(param.tableId)
  const filteredViewList = viewList.filter((view: any) => {
    return Object.keys(param?.user?.roles).some(
      (role) => param?.user?.roles[role] && !view.disabled[role]
    );
  });

  return filteredViewList;
}

// @ts-ignore
export async function shareView(param: { viewId: string }) {
  Tele.emit('evt', { evt_type: 'sharedView:generated-link' });
  return await View.share(param.viewId);
}

// @ts-ignore
export async function viewUpdate(param: { viewId: string; view: ViewReqType }) {
  const result = await View.update(param.viewId, param.view);
  Tele.emit('evt', { evt_type: 'vtable:updated', show_as: result.type });
  return result;
}

// @ts-ignore
export async function viewDelete(param: { viewId: string }) {
  await View.delete(param.viewId);
  Tele.emit('evt', { evt_type: 'vtable:deleted' });
  return true;
}

export async function shareViewUpdate(param: {
  viewId: string;
  sharedView: SharedViewReqType;
}) {
  Tele.emit('evt', { evt_type: 'sharedView:updated' });
  return await View.update(param.viewId, param.sharedView);
}

export async function shareViewDelete(param: { viewId: string }) {
  Tele.emit('evt', { evt_type: 'sharedView:deleted' });
  await View.sharedViewDelete(param.viewId);
  return true;
}

export async function showAllColumns(param: {
  viewId: string;
  ignoreIds?: string[];
}) {
  await View.showAllColumns(param.viewId, param.ignoreIds || []);
  return true;
}

export async function hideAllColumns(param: {
  viewId: string;
  ignoreIds?: string[];
}) {
  await View.hideAllColumns(param.viewId, param.ignoreIds || []);
  return true;
}

export async function shareViewList(param: { tableId: string }) {
  return await View.shareViewList(param.tableId);
}
