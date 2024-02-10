import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestMiddleware } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';
import { LicenseService } from '../../services/license/license.service';

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  constructor(
    protected readonly config: ConfigService<AppConfig>,
    private readonly licenseService: LicenseService,
  ) {}

  use(req: any, res: any, next: () => void) {
    req.ncSiteUrl = this.licenseService.getLicenseData().siteUrl;

    const dashboardPath = this.config.get('dashboardPath', {
      infer: true,
    });

    // used for playwright tests so env is not documented
    req.dashboardUrl = req.ncSiteUrl + dashboardPath;
    next();
  }
}
