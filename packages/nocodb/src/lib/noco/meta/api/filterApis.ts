import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../../noco-models/Model';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
// @ts-ignore
import { Table, TableList, TableListParams, TableReq } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../../sqlMgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../../noco-models/Project';
import Filter from '../../../noco-models/Filter';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { Tele } from 'nc-help';

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
      viewId: req.params.viewId,
      parentId: req.params.filterParentId
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
      fk_view_id: req.params.viewId
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
      fk_view_id: req.params.viewId
    });
    Tele.emit('evt', { evt_type: 'table:updated' });
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
    Tele.emit('evt', { evt_type: 'table:deleted' });
    res.json(filter);
  } catch (e) {
    console.log(e);
    next(e);
  }
}

const router = Router({ mergeParams: true });
router.get('/views/:viewId/filters/', ncMetaAclMw(filterList));
router.post('/views/:viewId/filters/', ncMetaAclMw(filterCreate));
router.get('/views/:viewId/filters/:filterId', ncMetaAclMw(filterGet));
router.put('/views/:viewId/filters/:filterId', ncMetaAclMw(filterUpdate));
router.delete('/views/:viewId/filters/:filterId', ncMetaAclMw(filterDelete));
router.get(
  '/views/:viewId/filters/:filterParentId/children',
  ncMetaAclMw(filterChildrenRead)
);
export default router;
