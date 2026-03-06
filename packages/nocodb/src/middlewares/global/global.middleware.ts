import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestMiddleware } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';
import Noco from '~/Noco';

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  constructor(protected readonly config: ConfigService<AppConfig>) {}

  use(req: any, res: any, next: () => void) {
    req.ncSiteUrl =
      Noco.config?.envs?.[Noco.env]?.publicUrl ||
      Noco.config?.publicUrl ||
      req.protocol + '://' + req.get('host');
    req.ncFullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    const dashboardUrl = process.env.NC_DASHBOARD_URL;

    // If NC_DASHBOARD_URL is a full URL (split-frontend mode), use it directly.
    // Otherwise the frontend lives at root, so dashboardUrl = siteUrl.
    req.dashboardUrl =
      dashboardUrl?.startsWith('http') ? dashboardUrl : req.ncSiteUrl;
    next();
  }
}
