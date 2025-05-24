import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestMiddleware } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';
import Noco from '~/Noco';
import { serverConfig } from 'config';

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  constructor(protected readonly config: ConfigService<AppConfig>) {}

  use(req: any, _: any, next: () => void) {
    req.ncSiteUrl =
      Noco.config?.envs?.[Noco.env]?.publicUrl ||
      Noco.config?.publicUrl ||
      req.protocol + '://' + req.get('host');
    req.ncFullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    // used for playwright tests so env is not documented
    req.dashboardUrl = serverConfig.dashboardUrl;
    next();
  }
}
