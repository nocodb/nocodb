import { Injectable } from '@nestjs/common';
import NcToolGui from 'nc-lib-gui';
import { ConfigService } from '@nestjs/config';
import type { NestMiddleware } from '@nestjs/common';
import type { AppConfig } from '~/interface/config';

@Injectable()
export class GuiMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService<AppConfig>) {}

  use(req: any, res: any, next: () => void) {
    const dashboardPath = this.configService.get('dashboardPath', {
      infer: true,
    });
    NcToolGui.expressMiddleware(dashboardPath)(req, res, next);
  }
}
