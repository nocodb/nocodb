import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ncIsString } from 'nocodb-sdk';
import type { NestMiddleware } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';
import Noco from '~/Noco';
import { setFrameGuardHeaders } from '~/helpers/frameGuard';

const TAB_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  constructor(protected readonly config: ConfigService<AppConfig>) {}

  use(req: any, res: any, next: () => void) {
    // Covers API responses, plus the SPA shell in dev / split-frontend where
    // GuiMiddleware is inert. In built deployments GuiMiddleware serves the
    // shell and terminates before this runs, so it sets the header itself.
    setFrameGuardHeaders(req, res);

    req.ncSiteUrl =
      Noco.config?.ncSiteUrl || req.protocol + '://' + req.get('host');
    req.ncFullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    const rawTabId = req.headers?.['x-nc-tab-id'];
    if (ncIsString(rawTabId) && TAB_ID_RE.test(rawTabId)) {
      req.ncTabId = rawTabId;
    }

    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    // used for playwright tests so env is not documented
    req.dashboardUrl =
      process.env.NC_DASHBOARD_URL || req.ncSiteUrl + dashboardPath;
    next();
  }
}
