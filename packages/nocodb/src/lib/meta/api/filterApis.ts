import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
// @ts-ignore
import { Table, TableList, TableListParams, TableReq } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../models/Project';
import Filter from '../../models/Filter';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

// @ts-ignore
export async function filterGet(req: Request, res: Response, next) {
  try {
    const filter = await Filter.getFilterObject({ viewId: req.params.viewId });

    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

// @ts-ignore
export async function filterList(
  req: Request<any, any, any, TableListParams>,
  res: Response,
  next
) {
  try {
    const filter = await Filter.rootFilterList({ viewId: req.params.viewId });

    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}
// @ts-ignore
export async function filterChildrenRead(
  req: Request<any, any, any, TableListParams>,
  res: Response,
  next
) {
  try {
    const filter = await Filter.parentFilterList({
      parentId: req.params.filterParentId,
    });

    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function filterCreate(
  req: Request<any, any, TableReq>,
  res,
  next
) {
  try {
    const filter = await Filter.insert({
      ...req.body,
      fk_view_id: req.params.viewId,
    });

    Tele.emit('evt', { evt_type: 'filter:created' });
    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

// @ts-ignore
export async function filterUpdate(req, res, next) {
  try {
    const filter = await Filter.update(req.params.filterId, {
      ...req.body,
      fk_view_id: req.params.viewId,
    });
    Tele.emit('evt', { evt_type: 'filter:updated' });
    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

// @ts-ignore
export async function filterDelete(req: Request, res: Response, next) {
  try {
    const filter = await Filter.delete(req.params.filterId);
    Tele.emit('evt', { evt_type: 'filter:deleted' });
    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

export async function hookFilterList(
  req: Request<any, any, any, TableListParams>,
  res: Response
) {
  const filter = await Filter.rootFilterListByHook({
    hookId: req.params.hookId,
  });

  res.json(filter);
}

export async function hookFilterCreate(req: Request<any, any, TableReq>, res) {
  const filter = await Filter.insert({
    ...req.body,
    fk_hook_id: req.params.hookId,
  });

  Tele.emit('evt', { evt_type: 'hookFilter:created' });
  res.json(filter);
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/meta/views/:viewId/filters',
  metaApiMetrics,
  ncMetaAclMw(filterList, 'filterList')
);
router.post(
  '/api/v1/db/meta/views/:viewId/filters',
  metaApiMetrics,
  ncMetaAclMw(filterCreate, 'filterCreate')
);

router.get(
  '/api/v1/db/meta/hooks/:hookId/filters',
  ncMetaAclMw(hookFilterList, 'filterList')
);
router.post(
  '/api/v1/db/meta/hooks/:hookId/filters',
  metaApiMetrics,
  ncMetaAclMw(hookFilterCreate, 'filterCreate')
);

router.get(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterGet, 'filterGet')
);
router.patch(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterUpdate, 'filterUpdate')
);
router.delete(
  '/api/v1/db/meta/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterDelete, 'filterDelete')
);
router.get(
  '/api/v1/db/meta/filters/:filterParentId/children',
  metaApiMetrics,
  ncMetaAclMw(filterChildrenRead, 'filterChildrenRead')
);
export default router;
