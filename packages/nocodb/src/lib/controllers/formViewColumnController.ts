import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../meta/helpers/apiMetrics';
import { getAjvValidatorMw } from '../meta/api/helpers';
import { formViewColumnService } from '../services';

export async function columnUpdate(req: Request, res: Response) {
  res.json(
    await formViewColumnService.columnUpdate({
      formViewColumnId: req.params.formViewColumnId,
      formViewColumn: req.body,
    })
  );
}

const router = Router({ mergeParams: true });
router.patch(
  '/api/v1/db/meta/form-columns/:formViewColumnId',
  metaApiMetrics,
  getAjvValidatorMw('swagger.json#/components/schemas/FormColumnReq'),
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);
export default router;
