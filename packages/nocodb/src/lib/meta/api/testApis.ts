import { Request, Router } from 'express';
import { TestResetService } from '../../services/test/TestResetService';

export async function reset(_: Request<any, any>, res) {
  const service = new TestResetService();

  res.json(await service.process());
}

const router = Router({ mergeParams: true });

router.get('/api/v1/meta/test/reset', reset);
export default router;
