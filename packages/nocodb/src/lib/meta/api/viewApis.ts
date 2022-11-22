import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
// @ts-ignore
import { Table, TableReq, ViewList } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../models/Project';
import View from '../../models/View';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { xcVisibilityMetaGet } from './modelVisibilityApis';
import { metaApiMetrics } from '../helpers/apiMetrics';
// @ts-ignore
export async function viewGet(req: Request, res: Response<Table>) {}

// @ts-ignore
export async function viewList(
  req: Request<any, any, any>,
  res: Response<ViewList>
) {
  const model = await Model.get(req.params.tableId);

  const viewList = await xcVisibilityMetaGet(
    // req.params.projectId,
    // req.params.baseId,
    model.project_id,
    [model]
  );

  //await View.list(req.params.tableId)
  const filteredViewList = viewList.filter((view: any) => {
    return Object.keys((req as any).session?.passport?.user?.roles).some(
      (role) =>
        (req as any)?.session?.passport?.user?.roles[role] &&
        !view.disabled[role]
    );
  });

  res.json(new PagedResponseImpl(filteredViewList));
}

// @ts-ignore
export async function shareView(
  req: Request<any, any, any>,
  res: Response<View>
) {
  Tele.emit('evt', { evt_type: 'sharedView:generated-link' });
  res.json(await View.share(req.params.viewId));
}

// @ts-ignore
export async function viewCreate(req: Request<any, any>, res, next) {}

// @ts-ignore
export async function viewUpdate(req, res) {
  const result = await View.update(req.params.viewId, req.body);
  Tele.emit('evt', { evt_type: 'vtable:updated', show_as: result.type });
  res.json(result);
}

// @ts-ignore
export async function viewDelete(req: Request, res: Response, next) {
  const result = await View.delete(req.params.viewId);
  Tele.emit('evt', { evt_type: 'vtable:deleted' });
  res.json(result);
}

async function shareViewUpdate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'sharedView:updated' });
  res.json(await View.update(req.params.viewId, req.body));
}

async function shareViewDelete(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'sharedView:deleted' });
  res.json(await View.sharedViewDelete(req.params.viewId));
}

async function showAllColumns(req: Request<any, any>, res) {
  res.json(
    await View.showAllColumns(
      req.params.viewId,
      <string[]>(req.query?.ignoreIds || [])
    )
  );
}

async function hideAllColumns(req: Request<any, any>, res) {
  res.json(
    await View.hideAllColumns(
      req.params.viewId,
      <string[]>(req.query?.ignoreIds || [])
    )
  );
}

async function shareViewList(req: Request<any, any>, res) {
  res.json(await View.shareViewList(req.params.tableId));
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/tables/:tableId/views',
  metaApiMetrics,
  ncMetaAclMw(viewList, 'viewList')
);
router.patch(
  '/api/v1/db/meta/views/:viewId',
  metaApiMetrics,
  ncMetaAclMw(viewUpdate, 'viewUpdate')
);
router.delete(
  '/api/v1/db/meta/views/:viewId',
  metaApiMetrics,
  ncMetaAclMw(viewDelete, 'viewDelete')
);
router.post(
  '/api/v1/db/meta/views/:viewId/show-all',
  metaApiMetrics,
  ncMetaAclMw(showAllColumns, 'showAllColumns')
);
router.post(
  '/api/v1/db/meta/views/:viewId/hide-all',
  metaApiMetrics,
  ncMetaAclMw(hideAllColumns, 'hideAllColumns')
);

router.get(
  '/api/v1/db/meta/tables/:tableId/share',
  metaApiMetrics,
  ncMetaAclMw(shareViewList, 'shareViewList')
);
router.post(
  '/api/v1/db/meta/views/:viewId/share',
  ncMetaAclMw(shareView, 'shareView')
);
router.patch(
  '/api/v1/db/meta/views/:viewId/share',
  metaApiMetrics,
  ncMetaAclMw(shareViewUpdate, 'shareViewUpdate')
);
router.delete(
  '/api/v1/db/meta/views/:viewId/share',
  metaApiMetrics,
  ncMetaAclMw(shareViewDelete, 'shareViewDelete')
);

export default router;
