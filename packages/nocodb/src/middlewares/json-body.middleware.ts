import { Injectable } from '@nestjs/common';
import * as express from 'express';
import type { NestMiddleware } from '@nestjs/common';

@Injectable()
export class JsonBodyMiddleware implements NestMiddleware {
  constructor() {}

  use(req: any, res: any, next: () => void) {
    express.json({ limit: process.env.NC_REQUEST_BODY_SIZE || '50mb' })(
      req,
      res,
      next,
    );
  }
}
