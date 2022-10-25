import Noco from '../../Noco';

import { Request, Router } from 'express';
import { TestResetService } from '../../services/test/TestResetService';

export async function reset(req: Request<any, any>, res) {
  console.log('resetting id', req.body);
  const service = new TestResetService({
    parallelId: req.body.parallelId,
    dbType: req.body.dbType,
    isEmptyProject: req.body.isEmptyProject,
  });

  res.json(await service.process());
}

export async function sqliteExec(req: Request<any, any>, res) {
  const metaKnex = Noco.ncMeta.knex;
  try {
    const result = await metaKnex.raw(req.body.sql);
    res.json({
      body: result,
    });
  } catch (e) {
    console.error('sqliteExec', e);
    res.status(500).json({
      error: e,
    });
  }
}

const router = Router({ mergeParams: true });

router.post('/api/v1/meta/test/reset', reset);
router.post('/api/v1/meta/test/sqlite_exec', sqliteExec);

export default router;
