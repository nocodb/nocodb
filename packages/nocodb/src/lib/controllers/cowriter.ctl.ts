import { Request, Response, Router } from 'express';
import ncMetaAclMw from '../meta/helpers/ncMetaAclMw';
import { CowriterListType, CowriterType } from 'nocodb-sdk';
import { cowriterService } from '../services';

export async function cowriterCreate(
  req: Request<any, CowriterType, CowriterType>,
  res: Response<CowriterType>
) {
  const cowriter = await cowriterService.cowriterCreate({
    cowriter: req.body,
    userId: req.params.userId,
    tableId: req.params.tableId,
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

export async function cowriterGenerateColumns(req, res) {
  const table = await cowriterService.cowriterGenerateColumns({
    tableId: req.params.tableId,
    title: req.body.title,
  });

  res.json(table);
}

export async function cowriterUpdate(req, res) {
  res.json(
    await cowriterService.cowriterUpdate({
      cowriterId: req.params.cowriterId,
      cowriter: req.body,
    })
  );
}

export async function cowriterList(
  req: Request,
  res: Response<CowriterListType>
) {
  const cowriterList = await cowriterService.cowriterList({
    tableId: req.params.tableId,
  });

  res.json(cowriterList);
}

export async function cowriterGet(req: Request, res: Response) {
  const cowriter = await cowriterService.cowriterGet({
    cowriterId: req.params.cowriterId,
  });
  res.json(cowriter);
}

const router = Router({ mergeParams: true });

router.post(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterCreate, 'cowriterCreate')
);

router.post(
  '/api/v1/cowriter/meta/tables/:tableId/bulk',
  ncMetaAclMw(cowriterCreateBulk, 'cowriterCreateBulk')
);

router.post(
  '/api/v1/cowriter/meta/tables/:tableId/generate-columns',
  ncMetaAclMw(cowriterGenerateColumns, 'cowriterGenerateColumns')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId',
  ncMetaAclMw(cowriterList, 'cowriterList')
);

router.get(
  '/api/v1/cowriter/meta/tables/:tableId/:cowriterId',
  ncMetaAclMw(cowriterGet, 'cowriterGet')
);

router.patch(
  '/api/v1/cowriter/meta/tables/:tableId/:cowriterId',
  ncMetaAclMw(cowriterUpdate, 'cowriterUpdate')
);

export default router;
