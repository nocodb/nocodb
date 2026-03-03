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
    // Collect candidate paths for the frontend dist directory
    const candidates: string[] = [];

    // 1. Entry-point provided path (Docker/cloud builds bundle frontend here)
    if (process.env.NC_GUI_DIST_PATH) {
      candidates.push(process.env.NC_GUI_DIST_PATH);
    }

    // 2. nc-lib-gui npm package (standard npm install)
    try {
      candidates.push(
        path.join(
          path.dirname(require.resolve('nc-lib-gui/package.json')),
          'lib',
          'dist',
        ),
      );
    } catch {
      // nc-lib-gui not installed
    }

    for (const distPath of candidates) {
      try {
        const indexPath = path.join(distPath, 'index.html');
        if (!fs.existsSync(indexPath)) continue;

        this.indexHtml = fs.readFileSync(indexPath, 'utf-8');

        const router = express.Router();
        router.use('/', express.static(distPath));
        this.staticRouter = router;
        return;
      } catch {
        // Try next candidate
      }
    }
  }

  use(req: Request, res: Response, next: () => void) {
    if (!this.staticRouter) return next();

    // Try serving a static asset (JS, CSS, images, fonts)
    this.staticRouter(req, res, () => {
      // No static file matched. For browser navigation requests
      // (non-file GET that accept text/html), serve index.html as
      // SPA fallback for history-mode routing.
      if (
        this.indexHtml &&
        !path.extname(req.path) &&
        req.headers.accept?.includes('text/html')
      ) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(this.indexHtml);
      }
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
