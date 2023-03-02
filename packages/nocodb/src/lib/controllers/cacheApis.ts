import catchError from '../meta/helpers/catchError';
import NocoCache from '../cache/NocoCache';
import { Router } from 'express';

export async function cacheGet(_, res) {
  const data = await NocoCache.export();
  res.set({
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="cache-export.json"`,
  });
  res.send(JSON.stringify(data));
}

export async function cacheDelete(_, res) {
  return res.json(await NocoCache.destroy());
}

const router = Router();
router.get('/api/v1/db/meta/cache', catchError(cacheGet));
router.delete('/api/v1/db/meta/cache', catchError(cacheDelete));
export default router;
