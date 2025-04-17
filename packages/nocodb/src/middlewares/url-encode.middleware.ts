import { Injectable } from '@nestjs/common';
import * as express from 'express';
import type { NestMiddleware } from '@nestjs/common';

@Injectable()
export class UrlEncodeMiddleware implements NestMiddleware {
  constructor() {}

  use(req: any, res: any, next: () => void) {
    express.urlencoded({ extended: true })(req, res, next);
  }
}
