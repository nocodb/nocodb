import { Request, Response, Router } from 'express';
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { View } from '../models';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { viewService } from '../services';

// @ts-ignore
export async function viewGet(req: Request, res: Response) {}

// @ts-ignore
export async function viewList(req: Request<any, any, any>, res: Response) {
  const filteredViewList = await viewService.viewList({
    tableId: req.params.tableId,
    user: (req as any).session?.passport?.user,
  });

  res.json(new PagedResponseImpl(filteredViewList));
}

// @ts-ignore
export async function shareView(
  req: Request<any, any, any>,
  res: Response<View>
) {
  res.json(await viewService.shareView({ viewId: req.params.viewId }));
}

// @ts-ignore
export async function viewCreate(req: Request<any, any>, res, next) {}

// @ts-ignore
export async function viewUpdate(req, res) {
  const result = await viewService.viewUpdate({
    viewId: req.params.viewId,
    view: req.body,
  });
  res.json(result);
}

// @ts-ignore
export async function viewDelete(req: Request, res: Response, next) {
  const result = await viewService.viewDelete({ viewId: req.params.viewId });
  res.json(result);
}

async function shareViewUpdate(req: Request<any, any>, res) {
  res.json(
    await viewService.shareViewUpdate({
      viewId: req.params.viewId,
      sharedView: req.body,
    })
  );
}

async function shareViewDelete(req: Request<any, any>, res) {
  res.json(await viewService.shareViewDelete({ viewId: req.params.viewId }));
}

async function showAllColumns(req: Request<any, any>, res) {
  res.json(
    await viewService.showAllColumns({
      viewId: req.params.viewId,
      ignoreIds: <string[]>(req.query?.ignoreIds || []),
    })
  );
}

async function hideAllColumns(req: Request<any, any>, res) {
  res.json(
    await viewService.hideAllColumns({
      viewId: req.params.viewId,
      ignoreIds: <string[]>(req.query?.ignoreIds || []),
    })
  );
}

async function shareViewList(req: Request<any, any>, res) {
  res.json(
    await viewService.shareViewList({
      tableId: req.params.tableId,
    })
  );
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
