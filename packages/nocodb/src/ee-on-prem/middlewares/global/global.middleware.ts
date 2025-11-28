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

    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    // used for playwright tests so env is not documented
    req.dashboardUrl =
      process.env.NC_DASHBOARD_URL || req.ncSiteUrl + dashboardPath;

    Noco.domains.add(req.ncSiteUrl);

    next();

    /* req.ncSiteUrl = this.licenseService.getLicenseData().siteUrl;

    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    // used for playwright tests so env is not documented
    req.dashboardUrl = req.ncSiteUrl + dashboardPath;
    next(); */
  }
}
