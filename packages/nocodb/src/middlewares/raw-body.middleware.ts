import { Injectable } from '@nestjs/common';
import * as express from 'express';
import type { NestMiddleware } from '@nestjs/common';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  constructor() {}

  use(req: any, res: any, next: () => void) {
    express.raw({ type: '*/*' })(req, res, next);
  }
}
