import {
  Controller,
  Get,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import getSwaggerHtml from './template/swaggerHtml';
import getRedocHtml from './template/redocHtml';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { ApiDocsService } from '~/services/api-docs/api-docs.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import Noco from '~/Noco';

@Controller()
export class ApiDocsController {
  constructor(private readonly apiDocsService: ApiDocsService) {}

  @Get(['/api/v1/db/meta/projects/:baseId/swagger.json'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('swaggerJson')
  async swaggerJson(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Request() req,
  ) {
    const swagger = await this.apiDocsService.swaggerJson(context, {
      baseId: baseId,
      siteUrl: req.ncSiteUrl,
    });

    return swagger;
  }

  @Get(['/api/v2/meta/bases/:baseId/swagger.json'])
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('swaggerJson')
  async swaggerJsonV2(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Request() req,
  ) {
    const swagger = await this.apiDocsService.swaggerJsonV2(context, {
      baseId: baseId,
      siteUrl: req.ncSiteUrl,
    });

    return swagger;
  }

  @Get(['/api/v1/db/meta/projects/:baseId/swagger'])
  @UseGuards(PublicApiLimiterGuard)
  swaggerHtml(@Param('baseId') baseId: string, @Response() res) {
    res.send(
      getSwaggerHtml({
        ncSiteUrl: process.env.NC_PUBLIC_URL || '',
        dashboardPath: Noco.getConfig().dashboardPath || '',
      }),
    );
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get(['/api/v1/db/meta/projects/:baseId/redoc'])
  redocHtml(@Param('baseId') baseId: string, @Response() res) {
    res.send(
      getRedocHtml({
        ncSiteUrl: process.env.NC_PUBLIC_URL || '',
        dashboardPath: Noco.getConfig().dashboardPath || '',
      }),
    );
  }

  @Get(['/api/v2/meta/bases/:baseId/swagger'])
  @UseGuards(PublicApiLimiterGuard)
  swaggerHtmlV2(@Param('baseId') baseId: string, @Response() res) {
    res.send(
      getSwaggerHtml({
        ncSiteUrl: process.env.NC_PUBLIC_URL || '',
        dashboardPath: Noco.getConfig().dashboardPath || '',
      }),
    );
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get(['/api/v2/meta/bases/:baseId/redoc'])
  redocHtmlV2(@Param('baseId') baseId: string, @Response() res) {
    res.send(
      getRedocHtml({
        ncSiteUrl: process.env.NC_PUBLIC_URL || '',
        dashboardPath: Noco.getConfig().dashboardPath || '',
      }),
    );
  }
}
