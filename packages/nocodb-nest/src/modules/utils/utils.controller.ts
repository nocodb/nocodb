import {
  Body,
  Controller,
  Get, HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
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

  @UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
  @Post('/api/v1/db/meta/connection/test')
  @Acl('testConnection')
  @HttpCode(200)
  async testConnection(@Body() body: any) {
    return await this.utilsService.testConnection({ body });
  }
  @Get('/api/v1/db/meta/nocodb/info')
  async appInfo(@Request() req) {
    return await this.utilsService.appInfo({
      req: {
        ncSiteUrl: (req as any).ncSiteUrl,
      },
    });
  }

  @Get('/api/v1/health')
  async appHealth() {
    return await this.utilsService.appHealth();
  }

  @Post('/api/v1/db/meta/axiosRequestMake')
  @HttpCode(200)
  async axiosRequestMake(@Body() body: any) {
    return await this.utilsService.axiosRequestMake({ body });
  }

  @Post('/api/v1/url_to_config')
  @HttpCode(200)
  async urlToDbConfig(@Body() body: any) {
    return await this.utilsService.urlToDbConfig({
      body,
    });
  }

  @Get('/api/v1/aggregated-meta-info')
  async aggregatedMetaInfo() {
    // todo: refactor
    return (await this.utilsService.aggregatedMetaInfo()) as any;
  }

}
