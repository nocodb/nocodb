import crypto from 'crypto';
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
  private dashboardPath: string = '/';

  // Pre-computed index.html response — avoids string→Buffer on every request
  private indexHtmlBuffer: Buffer | null = null;
  private indexHtmlEtag: string | null = null;

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

        // Patch Nuxt's runtime config baseURL to match the actual base path.
        // The frontend is built with baseURL:"/", but when deployed at a
        // subpath the router history base differs.  Without this patch,
        // Vue Router's to.fullPath includes the base (e.g. /sub/signup
        // instead of /signup), causing double-prefix redirects.
        if (baseHref !== '/') {
          rawHtml = rawHtml.replace(
            /baseURL:"\/"/g,
            `baseURL:"${baseHref}"`,
          );
        }

        // Pre-compute Buffer and ETag once — avoids per-request overhead
        this.indexHtmlBuffer = Buffer.from(rawHtml, 'utf-8');
        this.indexHtmlEtag = `"${crypto.createHash('md5').update(this.indexHtmlBuffer).digest('hex')}"`;

        const router = express.Router();
        const staticOptions: Parameters<typeof express.static>[1] = {
          // Don't serve index.html for directory requests — the SPA
          // fallback in GlobalExceptionFilter handles that with the
          // <base>-injected version.
          index: false,
          // Nuxt build output uses content-hashed filenames (e.g.
          // app.B3xH9k.js), so assets can be cached indefinitely.
          maxAge: '1y',
          immutable: true,
          // HTML files may change between deployments — don't cache them.
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        };

        router.use(this.dashboardPath, express.static(distPath, staticOptions));

        // When the dashboard is at a subpath, also mount static assets at
        // root so that absolute asset paths (e.g. /_nuxt/entry.js) still
        // resolve. The frontend build uses relative paths via <base> tag,
        // but this provides backward compat for any absolute references.
        if (this.dashboardPath !== '/') {
          router.use('/', express.static(distPath, staticOptions));
        }

        this.staticRouter = router;
        return;
      } catch {
        // skip invalid candidate
      }
    }
  }

  use(req: Request, res: Response, next: () => void) {
    if (!this.staticRouter) return next();

    // Skip static file lookup for backend routes — avoids unnecessary
    // filesystem checks on API calls.
    if (
      req.path.startsWith('/api/') ||
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/sso/')
    ) {
      return next();
    }

    // Try serving a static asset (JS, CSS, images, fonts).
    // If no file matches, fall through to NestJS controllers.
    // SPA fallback (index.html for unmatched routes) is handled by
    // GlobalExceptionFilter so that backend routes are tried first.
    this.staticRouter(req, res, () => {
      next();
    });
  }

  /**
   * Sends the pre-buffered index.html with proper caching headers.
   * Handles ETag/If-None-Match for 304 responses.
   * Returns false if index.html is not available.
   */
  sendIndexHtml(req: Request, res: Response): boolean {
    if (!this.indexHtmlBuffer) return false;

    // Return 304 if the browser already has the current version
    if (this.indexHtmlEtag && req.headers['if-none-match'] === this.indexHtmlEtag) {
      res.status(304).end();
      return true;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', this.indexHtmlBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    if (this.indexHtmlEtag) {
      res.setHeader('ETag', this.indexHtmlEtag);
    }
    res.end(this.indexHtmlBuffer);
    return true;
  }

  /**
   * Returns the normalized dashboard path (e.g. '/dashboard' or '/').
   * Used by GlobalExceptionFilter to scope the SPA fallback.
   */
  getDashboardPath(): string {
    return this.dashboardPath;
  }
}
