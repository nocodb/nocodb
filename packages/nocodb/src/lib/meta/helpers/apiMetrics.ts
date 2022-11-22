import { Request } from 'express';
import { Tele } from 'nc-help';

const countMap = {};

const metrics = async (req: Request, c = 150) => {
  if (!req?.route?.path) return;
  const event = `a:api:${req.route.path}:${req.method}`;
  countMap[event] = (countMap[event] || 0) + 1;
  if (countMap[event] >= c) {
    Tele.event({ event });
    countMap[event] = 0;
  }
};

const metaApiMetrics = (req: Request, _res, next) => {
  metrics(req, 50).then(() => {});
  next();
};
export default (req: Request, _res, next) => {
  metrics(req).then(() => {});
  next();
};

export { metaApiMetrics };
