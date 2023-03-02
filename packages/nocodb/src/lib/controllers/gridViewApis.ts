import { Request, Router } from 'express';
// @ts-ignore
import Model from '../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../meta/helpers/PagedResponse';
import { ViewTypes } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../models/Project';
import View from '../models/View';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import GridView from '../models/GridView';
import { getAjvValidatorMw } from '../meta/api/helpers';

// @ts-ignore
export async function gridViewCreate(req: Request<any, any>, res) {
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.GRID,
  });
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'grid' });
  res.json(view);
}

export async function gridViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'grid' });
  res.json(await GridView.update(req.params.viewId, req.body));
}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/grids/',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/GridReq'),
  ncMetaAclMw(gridViewCreate, 'gridViewCreate')
);
router.patch(
  '/api/v1/db/meta/grids/:viewId',
  metaApiMetrics,
  ncMetaAclMw(gridViewUpdate, 'gridViewUpdate')
);
export default router;
