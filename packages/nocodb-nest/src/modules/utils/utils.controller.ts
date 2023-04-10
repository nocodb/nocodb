import { Controller, Get, Request } from '@nestjs/common';
import { UtilsService } from './utils.service';

@Controller()
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Get('/api/v1/db/meta/nocodb/info')
  info(@Request() req) {
    return this.utilsService.info({
      ncSiteUrl: req.ncSiteUrl,
    });
  }

  @Get('/api/v1/version')
  version() {
    return this.utilsService.versionInfo();
  }
}
