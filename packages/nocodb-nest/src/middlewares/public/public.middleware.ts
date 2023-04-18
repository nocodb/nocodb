import { join } from 'path';
import { Injectable } from '@nestjs/common';
import express from 'express';
import type { NestMiddleware } from '@nestjs/common';

@Injectable()
export class PublicMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // redirect root to dashboard
    if (req.path === '/') {
      const dashboardPath = process.env.NC_DASHBOARD_URL || '/dashboard';
      return res.redirect(dashboardPath);
    }

    // serve static files from public folder
    express.static(join(process.cwd(), 'public'))(req, res, next);
  }
}
