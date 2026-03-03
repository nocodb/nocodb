import path from 'path';
import fs from 'fs';
import { Injectable, OnModuleInit } from '@nestjs/common';
import express from 'express';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class GuiMiddleware implements NestMiddleware, OnModuleInit {
  private staticRouter: express.Router | null = null;
  private indexHtml: string | null = null;

  onModuleInit() {
    try {
      const distPath = path.join(
        path.dirname(require.resolve('nc-lib-gui/package.json')),
        'lib',
        'dist',
      );

      this.indexHtml = fs.readFileSync(
        path.join(distPath, 'index.html'),
        'utf-8',
      );

      // Serve static assets but NOT index.html (SPA fallback handles it)
      const router = express.Router();
      router.use('/', express.static(distPath, { index: false }));
      this.staticRouter = router;
    } catch {
      // nc-lib-gui not installed (e.g. dev mode) — skip GUI serving
    }
  }

  use(req: Request, res: Response, next: () => void) {
    if (!this.staticRouter) return next();

    // Try serving a static asset (JS, CSS, images, fonts)
    this.staticRouter(req, res, () => {
      // Static file not found — just pass through.
      // SPA fallback is handled separately after all NestJS routes.
      next();
    });
  }

  /**
   * Returns the index.html content for SPA fallback,
   * or null if nc-lib-gui is not available.
   */
  getIndexHtml(): string | null {
    return this.indexHtml;
  }
}
