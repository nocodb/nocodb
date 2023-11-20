import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import Noco from '~/Noco';

@Injectable()
export class GlobalMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    req.ncSiteUrl =
      Noco.config?.envs?.[Noco.env]?.publicUrl ||
      Noco.config?.publicUrl ||
      req.protocol + '://' + req.get('host');
    req.ncFullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    next();
  }
}
