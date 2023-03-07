import type { Request, Response } from 'express';
import { Router } from 'express';
import ncMetaAclMw from '../../meta/helpers/ncMetaAclMw';
import { metaApiMetrics } from '../../meta/helpers/apiMetrics';
import { formViewColumnService } from '../../services';

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
  ncMetaAclMw(columnUpdate, 'columnUpdate')
);
export default router;
