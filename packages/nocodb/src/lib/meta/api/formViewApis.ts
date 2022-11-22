import { Request, Response, Router } from 'express';
// @ts-ignore
import Model from '../../models/Model';
import { Tele } from 'nc-help';
// @ts-ignore
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { FormType, ViewTypes } from 'nocodb-sdk';
// @ts-ignore
import ProjectMgrv2 from '../../db/sql-mgr/v2/ProjectMgrv2';
// @ts-ignore
import Project from '../../models/Project';
import View from '../../models/View';
import FormView from '../../models/FormView';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { metaApiMetrics } from '../helpers/apiMetrics';

// @ts-ignore
export async function formViewGet(req: Request, res: Response<FormType>) {
  const formViewData = await FormView.getWithInfo(req.params.formViewId);
  res.json(formViewData);
}

export async function formViewCreate(req: Request<any, any>, res) {
  Tele.emit('evt', { evt_type: 'vtable:created', show_as: 'form' });
  const view = await View.insert({
    ...req.body,
    // todo: sanitize
    fk_model_id: req.params.tableId,
    type: ViewTypes.FORM,
  });
  res.json(view);
}
// @ts-ignore
export async function formViewUpdate(req, res) {
  Tele.emit('evt', { evt_type: 'view:updated', type: 'grid' });
  res.json(await FormView.update(req.params.formViewId, req.body));
}

// @ts-ignore
export async function formViewDelete(req: Request, res: Response, next) {}

const router = Router({ mergeParams: true });
router.post(
  '/api/v1/db/meta/tables/:tableId/forms',
  metaApiMetrics,
  ncMetaAclMw(formViewCreate, 'formViewCreate')
);
router.get(
  '/api/v1/db/meta/forms/:formViewId',
  metaApiMetrics,
  ncMetaAclMw(formViewGet, 'formViewGet')
);
router.patch(
  '/api/v1/db/meta/forms/:formViewId',
  metaApiMetrics,
  ncMetaAclMw(formViewUpdate, 'formViewUpdate')
);
router.delete(
  '/api/v1/db/meta/forms/:formViewId',
  metaApiMetrics,
  ncMetaAclMw(formViewDelete, 'formViewDelete')
);
export default router;
