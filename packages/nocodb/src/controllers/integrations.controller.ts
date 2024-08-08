import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IntegrationReqType, IntegrationsType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { IntegrationsService } from '~/services/integrations.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationGet', {
    scope: 'org',
  })
  async integrationGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Query('includeConfig') includeConfig: string,
    @Query('includeSources') includeSources: string,
    @Req() req: NcRequest,
  ) {
    const integration = await this.integrationsService.integrationGetWithConfig(
      context,
      {
        integrationId,
        includeSources: includeSources === 'true',
      },
    );

    // hide config if not the owner or if not requested
    if (
      includeConfig !== 'true' ||
      (integration.is_private && req.user.id !== integration.created_by)
    )
      integration.config = undefined;

    return integration;
  }
  @Post(['/api/v2/meta/integrations'])
  @Acl('integrationCreate', {
    scope: 'org',
  })
  async integrationCreate(
    @TenantContext() context: NcContext,
    @Body() integration: IntegrationReqType,
    @Req() req: NcRequest,
  ) {
    return await this.integrationsService.integrationCreate(context, {
      integration,
      req,
    });
  }

  @Delete(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationDelete', {
    scope: 'org',
  })
  async integrationDelete(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Req() req: NcRequest,
    @Query('force') force: string,
  ) {
    return await this.integrationsService.integrationDelete(context, {
      req,
      integrationId,
      force: force === 'true',
    });
  }

  @Patch(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationUpdate', {
    scope: 'org',
  })
  async integrationUpdate(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Body() body: IntegrationReqType,
    @Req() req: NcRequest,
  ) {
    const integration = await this.integrationsService.integrationUpdate(
      context,
      {
        integration: body,
        integrationId,
        req,
      },
    );

    return integration;
  }

  @Get(['/api/v2/meta/integrations'])
  @Acl('integrationList', {
    scope: 'org',
    extendedScope: 'base',
  })
  async integrationList(
    @Req() req: NcRequest,
    @Query('type') type: IntegrationsType,
    @Query('includeDatabaseInfo') includeDatabaseInfo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('query') query?: string,
  ) {
    const integrations = await this.integrationsService.integrationList({
      req,
      includeDatabaseInfo: includeDatabaseInfo === 'true',
      type,
      // if limit/offset is not provided, then return all integrations
      limit: limit && (+limit || 25),
      offset: offset && (+offset || 0),
      query,
    });

    if (!includeDatabaseInfo) {
      for (const integration of integrations.list) {
        integration.config = undefined;
      }
    }

    return integrations;
  }
}
