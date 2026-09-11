import { Injectable } from '@nestjs/common';
import * as express from 'express';
import type { NestMiddleware } from '@nestjs/common';

/**
 * Parses JSON *and* keeps the bytes it parsed.
 *
 * Signed webhooks (Slack, GitHub, Discord) sign the payload exactly as sent, so
 * a re-serialised body never verifies — key order and whitespace both matter.
 * `express.raw` would preserve the bytes but leave the controller without a
 * parsed body; this keeps both, and marks the body as read so the global JSON
 * middleware downstream skips it.
 */
@Injectable()
export class SignedBodyMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    express.json({
      limit: process.env.NC_REQUEST_BODY_SIZE || '1mb',
      type: ['application/json'],
      verify: (request: any, _res, buf: Buffer) => {
        request.rawBody = buf;
      },
    })(req, res, next);
  }
}
