import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { CowriterListType, CowriterType } from 'nocodb-sdk';
import Cowriter from '../../models/Cowriter';
import { PagedResponseImpl } from '../helpers/PagedResponse';

export async function cowriterCreate(
  req: Request<any, CowriterType, CowriterType>,
  res: Response<CowriterType>
) {
  const cowriter = await Cowriter.insert({
    ...req.body,
    fk_model_id: req.params.tableId,
    created_by: (req as any).user.id,
  });
  res.json(cowriter);
}

export async function cowriterCreateBulk(
  _req: Request<any, CowriterType, CowriterType>,
  res: Response<CowriterType>
) {
  // TODO:
  res.json({});
}

export async function cowriterList(
  req: Request,
  res: Response<CowriterListType>
) {
  const cowriterList = await Cowriter.list({
    fk_model_id: req.params.fk_model_id,
  });

  res.json(new PagedResponseImpl(cowriterList));
}

export async function cowriterGet(req: Request, res: Response) {
  const cowriter = await Cowriter.get(req.params.cowriterId);
  res.json(cowriter);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterCreate, 'cowriterCreate')
);

router.post(
  '/api/v1/cowriter/meta/tables/:tableId/generate/bulk',
  ncMetaAclMw(cowriterCreateBulk, 'cowriterCreateBulk')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterList, 'cowriterList')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId/:cowriterId',
  ncMetaAclMw(cowriterGet, 'cowriterGet')
);

export default router;
