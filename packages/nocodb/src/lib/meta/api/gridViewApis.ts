import { Request, Router } from 'express';
// @ts-ignore
import Model from '../../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { ViewTypes } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../models/Project';
import View from '../../models/View';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

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

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/grids/',
  metaApiMetrics,
  ncMetaAclMw(gridViewCreate, 'gridViewCreate')
);
export default router;
