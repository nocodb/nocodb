import { Router } from 'express';
import { TestResetService } from '../services/test/TestResetService';
import type { Request } from 'express';

export async function reset(req: Request<any, any>, res) {
  const service = new TestResetService({
    parallelId: req.body.parallelId,
    dbType: req.body.dbType,
    isEmptyProject: req.body.isEmptyProject,
    workerId: req.body.workerId,
    projectType: req.body.projectType,
  });

  res.json(await service.process());
}

const router = Router();

router.post('/api/v1/meta/test/reset', reset);

export default router;
