import { Injectable } from '@nestjs/common';
import * as express from 'express';
import type { NestMiddleware } from '@nestjs/common';

/**
 * Raw body for the app-llm proxy route only. Mirrors JsonBodyMiddleware's size
 * limit (NC_REQUEST_BODY_SIZE || '50mb') so large Anthropic requests (long
 * context + images) forward verbatim, while the shared 100kb-default
 * RawBodyMiddleware stays tight for the Stripe webhook.
 */
@Injectable()
export class AppLlmRawBodyMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    express.raw({
      type: '*/*',
      limit: process.env.NC_REQUEST_BODY_SIZE || '50mb',
    })(req, res, next);
  }
}
