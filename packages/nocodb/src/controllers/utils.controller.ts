import fs from 'fs';
import { promisify } from 'util';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProjectRoles, validateAndExtractSSLProp } from 'nocodb-sdk';
import {
  ErrorReportReqType,
  getTestDatabaseName,
  IntegrationsType,
  OrgUserRoles,
} from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { UtilsService } from '~/services/utils.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TelemetryService } from '~/services/telemetry.service';
import { NcRequest } from '~/interface/config';
import { Integration } from '~/models';
import { MetaTable, RootScopes } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';
import { deepMerge, isEE } from '~/utils';
import Noco from '~/Noco';

@Controller()
export class UtilsController {
  private version: string;

  constructor(
    protected readonly utilsService: UtilsService,
    protected readonly telemetryService: TelemetryService,
  ) {}

  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v1/version')
  async getVersion() {
    if (process.env.NC_CLOUD !== 'true') {
      return this.utilsService.versionInfo();
    }

    if (!this.version) {
      try {
        this.version = await promisify(fs.readFile)('./public/nc.txt', 'utf-8');
      } catch {
        this.version = 'Not available';
      }
    }
    return this.version;
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post(['/api/v1/db/meta/connection/test', '/api/v2/meta/connection/test'])
  @Acl('testConnection', {
    scope: 'org',
  })
  @HttpCode(200)
  async testConnection(@Body() body: any, @Req() req: NcRequest) {
    body.pool = {
      min: 0,
      max: 1,
    };

    let config = { ...body };

    if (body.fk_integration_id) {
      const integration = await Integration.get(
        {
          workspace_id: RootScopes.BYPASS,
        },
        body.fk_integration_id,
      );

      if (!integration || integration.type !== IntegrationsType.Database) {
        NcError.integrationNotFound(body.fk_integration_id);
      }

      if (integration.is_private && integration.created_by !== req.user.id) {
        NcError.forbidden('You do not have access to this integration');
      }

      if (!req.user.roles[OrgUserRoles.CREATOR]) {
        // check if user have owner/creator role in any of the base in the workspace
        const baseWithPermission = await Noco.ncMeta
          .knex(MetaTable.PROJECT_USERS)
          .innerJoin(
            MetaTable.PROJECT,
            `${MetaTable.PROJECT}.id`,
            `${MetaTable.PROJECT_USERS}.base_id`,
          )
          .where(`${MetaTable.PROJECT_USERS}.fk_user_id`, req.user.id)
          .where((qb) => {
            qb.where(
              `${MetaTable.PROJECT_USERS}.roles`,
              ProjectRoles.OWNER,
            ).orWhere(`${MetaTable.PROJECT_USERS}.roles`, ProjectRoles.CREATOR);
          })
          .first();

        if (!baseWithPermission)
          NcError.forbidden('You do not have access to this integration');
      }

      config = await integration.getConfig();
      deepMerge(config, body);

      if (config?.connection?.database) {
        config.connection.database = getTestDatabaseName(config);
      }
    }

    if (config.connection?.ssl) {
      config.connection.ssl = validateAndExtractSSLProp(
        config.connection,
        config.sslUse,
        config.client,
      );
    }

    return await this.utilsService.testConnection({ body: config });
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get([
    '/api/v1/db/meta/nocodb/info',
    '/api/v2/meta/nocodb/info',
    '/api/v1/meta/nocodb/info',
  ])
  async appInfo(@Req() req: NcRequest) {
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

  @UseGuards(PublicApiLimiterGuard)
  @Post(['/api/v1/db/meta/axiosRequestMake', '/api/v2/meta/axiosRequestMake'])
  @HttpCode(200)
  async axiosRequestMake(@Body() body: any) {
    return await this.utilsService.axiosRequestMake({ body });
  }

  @UseGuards(PublicApiLimiterGuard)
  @Post('/api/v1/url_to_config')
  @HttpCode(200)
  async urlToDbConfig(@Body() body: any) {
    return await this.utilsService.urlToDbConfig({
      body,
    });
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v1/aggregated-meta-info')
  async aggregatedMetaInfo() {
    // todo: refactor
    return (await this.utilsService.aggregatedMetaInfo()) as any;
  }

  @UseGuards(PublicApiLimiterGuard)
  @Get('/api/v2/feed')
  async feed(@Request() req: NcRequest) {
    return await this.utilsService.feed(req);
  }

  @UseGuards(PublicApiLimiterGuard)
  @Post('/api/v1/error-reporting')
  async reportErrors(@Req() req: NcRequest, @Body() body: ErrorReportReqType) {
    if (
      `${process.env.NC_DISABLE_ERR_REPORTS}` === 'true' ||
      isEE ||
      process.env.NC_SENTRY_DSN
    ) {
      return {};
    }

    return (await this.utilsService.reportErrors({
      req,
      body,
    })) as any;
  }
}
