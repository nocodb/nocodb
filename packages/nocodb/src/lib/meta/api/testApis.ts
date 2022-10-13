import { Request, Router } from 'express';
import { TestResetService } from '../../services/test/TestResetService';

export async function reset(req: Request<any, any>, res) {
  console.log('resetting id', req.body);
  const service = new TestResetService({
    parallelId: req.body.parallelId,
    dbType: req.body.dbType,
  });

  res.json(await service.process());
}

const router = Router({ mergeParams: true });

router.post('/api/v1/meta/test/reset', reset);
export default router;
