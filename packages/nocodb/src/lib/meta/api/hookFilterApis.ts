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
    const filter = await Filter.getFilterObject({ hookId: req.params.hookId });

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
    const filter = await Filter.rootFilterListByHook({
      hookId: req.params.hookId,
    });

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
    const filter = await Filter.parentFilterListByHook({
      hookId: req.params.hookId,
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
      fk_hook_id: req.params.hookId,
    });

    Tele.emit('evt', { evt_type: 'hookFilter:created' });
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
      fk_hook_id: req.params.hookId,
    });
    Tele.emit('evt', { evt_type: 'hookFilter:updated' });
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
    Tele.emit('evt', { evt_type: 'hookFilter:deleted' });
    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });
router.get(
  '/hooks/:hookId/filters/',
  metaApiMetrics,
  ncMetaAclMw(filterList, 'filterList')
);
router.post(
  '/hooks/:hookId/filters/',
  metaApiMetrics,
  ncMetaAclMw(filterCreate, 'filterCreate')
);
router.get(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterGet, 'filterGet')
);
router.patch(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterUpdate, 'filterUpdate')
);
router.delete(
  '/hooks/:hookId/filters/:filterId',
  metaApiMetrics,
  ncMetaAclMw(filterDelete, 'filterDelete')
);
router.get(
  '/hooks/:hookId/filters/:filterParentId/children',
  metaApiMetrics,
  ncMetaAclMw(filterChildrenRead, 'filterChildrenRead')
);
export default router;
