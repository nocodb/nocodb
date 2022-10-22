import { Router } from 'express';
import { LICENSE_KEY } from '../../../constants';
import Store from '../../../models/Store';

export const validateEE = async (_req, res, next) => {
  const key = await Store.get(LICENSE_KEY);
  if (!key?.value) {
    return res.status(403).json({ msg: 'Not available' });
  }
  next();
};

const router = Router({ mergeParams: true });

// verify key
// router.use((_req, _res, next) => {});

export default router;
