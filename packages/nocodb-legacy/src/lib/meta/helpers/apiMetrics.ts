import { T } from 'nc-help';
import type { Request } from 'express';

const countMap = {};

// @ts-ignore
const metrics = async (req: Request, c = 150) => {
  if (!req?.route?.path) return;
  const event = `a:api:${req.route.path}:${req.method}`;
  countMap[event] = (countMap[event] || 0) + 1;
  if (countMap[event] >= c) {
    T.event({ event });
    countMap[event] = 0;
  }
};

const metaApiMetrics = (_req: Request, _res, next) => {
  // metrics(req, 50).then(() => {});
  next();
};
export default (_req: Request, _res, next) => {
  // metrics(req).then(() => {});
  next();
};

export { metaApiMetrics };
