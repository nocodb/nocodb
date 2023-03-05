import { Request, Response, Router } from 'express';
import { FormType } from 'nocodb-sdk';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { formViewService } from '../services';

export async function formViewGet(req: Request, res: Response<FormType>) {
  const formViewData = await formViewService.formViewGet({
    formViewId: req.params.formViewId,
  });
  res.json(formViewData);
}

export async function formViewCreate(req: Request<any, any>, res) {
  const view = await formViewService.formViewCreate({
    body: req.body,
    tableId: req.params.tableId,
  });
  res.json(view);
}

export async function formViewUpdate(req, res) {
  res.json(
    await formViewService.formViewUpdate({
      formViewId: req.params.formViewId,
      body: req.body,
    })
  );
}

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

export default router;
