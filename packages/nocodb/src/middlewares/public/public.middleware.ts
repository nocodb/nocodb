import path, { join } from 'path';
import { Injectable } from '@nestjs/common';
import express from 'express';
import isDocker from 'is-inside-container';
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
    if (isDocker()) {
      express.static(join(process.cwd(), 'docker', 'public'))(req, res, next);
    } else {
      express.static(join(process.cwd(), 'public'))(req, res, next);
    }
  }
}
