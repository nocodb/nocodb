import path from 'path';
import fs from 'fs';
import { Injectable } from '@nestjs/common';
import express from 'express';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';

// TODO: remove once nc-lib-gui is removed
// Use the real Node.js require, not rspack's transformed version.
// rspack replaces require.resolve() with a module ID string at compile
// time, which breaks path resolution for nc-lib-gui.
// eslint-disable-next-line no-restricted-globals
declare const __non_webpack_require__: typeof require;
const _require =
  typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : require;

@Injectable()
export class GuiMiddleware implements NestMiddleware {
  private staticRouter: express.Router | null = null;
  private indexHtml: string | null = null;
  private dashboardPath: string = '/';

  constructor() {
    // In split-frontend mode (NC_DASHBOARD_URL is a full URL pointing to
    // a separate frontend server, e.g. http://localhost:3000), the backend
    // should not serve frontend files at all.
    const dashboardUrl = process.env.NC_DASHBOARD_URL || '/';
    if (dashboardUrl.startsWith('http')) return;

    this.dashboardPath = dashboardUrl.replace(/\/+$/, '') || '/';

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
          path.dirname(_require.resolve('nc-lib-gui/package.json')),
          'lib',
          'dist',
        ),
      );
    } catch {
      // nc-lib-gui not installed
    }

    for (const distPath of candidates) {
      try {
        if (!fs.existsSync(path.join(distPath, 'index.html'))) continue;

        let rawHtml = fs.readFileSync(
          path.join(distPath, 'index.html'),
          'utf-8',
        );

        // Compute the browser-visible base path for the <base> tag.
        // This combines the NC_PUBLIC_URL pathname (reverse-proxy prefix that
        // gets stripped before reaching the backend) with NC_DASHBOARD_URL
        // (the backend-visible subpath).
        //
        // Examples:
        //   NC_PUBLIC_URL unset,       NC_DASHBOARD_URL=/          → /
        //   NC_PUBLIC_URL unset,       NC_DASHBOARD_URL=/dashboard → /dashboard/
        //   NC_PUBLIC_URL=host/nocodb, NC_DASHBOARD_URL=/          → /nocodb/
        //   NC_PUBLIC_URL=host/nocodb, NC_DASHBOARD_URL=/dashboard → /nocodb/dashboard/
        let browserBase = this.dashboardPath;
        const publicUrl = process.env.NC_PUBLIC_URL;
        if (publicUrl) {
          try {
            const publicPath = new URL(publicUrl).pathname.replace(/\/+$/, '');
            if (publicPath && publicPath !== '/') {
              browserBase =
                publicPath +
                (this.dashboardPath === '/' ? '' : this.dashboardPath);
            }
          } catch {
            // invalid NC_PUBLIC_URL, ignore
          }
        }
        const baseHref =
          browserBase === '/' ? '/' : `${browserBase}/`;
        rawHtml = rawHtml.replace(
          '<head>',
          `<head><base href="${baseHref}">`,
        );

        this.indexHtml = rawHtml;

        const router = express.Router();
        router.use('/', express.static(distPath));
        this.staticRouter = router;
        return;
      } catch {
        // skip invalid candidate
      }
    }
  }

  use(req: Request, res: Response, next: () => void) {
    if (!this.staticRouter) return next();

    // Try serving a static asset (JS, CSS, images, fonts).
    // If no file matches, fall through to NestJS controllers.
    // SPA fallback (index.html for unmatched routes) is handled by
    // GlobalExceptionFilter so that backend routes are tried first.
    this.staticRouter(req, res, () => {
      next();
    });
  }

  /**
   * Returns the index.html content (with <base> tag injected) for SPA
   * fallback, or null if nc-lib-gui is not available.
   */
  getIndexHtml(): string | null {
    return this.indexHtml;
  }

  /**
   * Returns the normalized dashboard path (e.g. '/dashboard' or '/').
   */
  getDashboardPath(): string {
    return this.dashboardPath;
  }
}
