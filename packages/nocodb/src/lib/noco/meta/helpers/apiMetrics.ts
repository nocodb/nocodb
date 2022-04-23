import { Request } from 'express';
import { Tele } from 'nc-help';

const countMap = {};

const metrics = async (req: Request) => {
  if (!req?.route?.path) return;
  const event = `a:api:${req.route.path}:${req.method}`;
  countMap[event] = (countMap[event] || 0) + 1;
  if (countMap[event] >= 50) {
    Tele.event({ event });
    countMap[event] = 0;
  }
};

export default async (req: Request, _res, next) => {
  metrics(req).then(() => {});
  next();
};
