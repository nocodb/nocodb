import path from 'path';
import fs from 'fs';
import { Injectable } from '@nestjs/common';
import express from 'express';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { injectBrandingMeta } from '~/helpers/brandingHtml';
import { setFrameGuardHeaders } from '~/helpers/frameGuard';

@Injectable()
export class GuiMiddleware implements NestMiddleware {
  private staticRouter: express.Router | null = null;
  private indexHtml: string | null = null;

  constructor() {
    // In split-frontend mode (NC_DASHBOARD_URL is a full URL pointing to
    // a separate frontend server, e.g. http://localhost:3000), the backend
    // should not serve frontend files at all.
    const dashboardUrl = process.env.NC_DASHBOARD_URL || '/';
    if (dashboardUrl.startsWith('http')) return;

    // NC_GUI_DIST_PATH is set by entry points (Docker, cloud, executables)
    // to point to the built frontend dist directory.
    const distPath = process.env.NC_GUI_DIST_PATH;
    if (!distPath) return;

    try {
      if (!fs.existsSync(path.join(distPath, 'index.html'))) return;

      this.indexHtml = fs.readFileSync(
        path.join(distPath, 'index.html'),
        'utf-8',
      );

      const router = express.Router();
      router.use('/', express.static(distPath));
      this.staticRouter = router;
    } catch {
      // dist path not available
    }
  }

  async use(req: Request, res: Response, next: () => void) {
    if (!this.staticRouter || !this.indexHtml) return next();

    // Set before branching: this middleware terminates the request, so
    // GlobalMiddleware never runs for anything served here — including the shell
    // the static branch returns for `/`, which `<object>`/`<embed>` fetch with
    // `Accept: */*`.
    setFrameGuardHeaders(req, res);

    // Non-HTML requests (JS, CSS, images, fonts) are real static files — let
    // express.static serve them, falling through to `next()` when nothing
    // matched. We gate on Accept the same way the SPA fallback always has.
    const wantsHtml = req.headers.accept?.includes('text/html');
    if (!wantsHtml) {
      return this.staticRouter(req, res, next);
    }

    // Browser navigation (incl. the root `/`): serve the index shell. White-
    // label instances get their brand injected into <head> so crawlers / link
    // unfurlers — which never run our JS — see the configured brand instead of
    // the build-time NocoDB defaults. CE / non-white-label is a no-op passthru.
    // Any injection error falls back to the unmodified shell.
    let html = this.indexHtml;
    try {
      html = await injectBrandingMeta(html, req);
    } catch {
      html = this.indexHtml;
    }
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Returns the index.html content for SPA fallback,
   * or null if the GUI dist is not available.
   */
  getIndexHtml(): string | null {
    return this.indexHtml;
  }
}
