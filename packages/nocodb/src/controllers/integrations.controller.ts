import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { IntegrationsService } from '~/services/integrations.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/bases/:integrationId',
    '/api/v2/meta/bases/:baseId/integrations/:integrationId',
  ])
  @Acl('baseGet')
  async baseGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
  ) {
    const integration = await this.integrationsService.baseGetWithConfig(context, {
      integrationId,
    });

    if (integration.isMeta()) {
      delete integration.config;
    }

    return integration;
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/bases/:integrationId',
    '/api/v2/meta/bases/:baseId/integrations/:integrationId',
  ])
  @Acl('baseUpdate')
  async baseUpdate(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Param('baseId') baseId: string,
    @Body() body: BaseReqType,
    @Req() req: NcRequest,
  ) {
    const integration = await this.integrationsService.baseUpdate(context, {
      integrationId,
      integration: body,
      baseId,
      req,
    });

    return integration;
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/bases',
    '/api/v2/meta/bases/:baseId/integrations',
  ])
  @Acl('baseList')
  async baseList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    const integrations = await this.integrationsService.baseList(context, {
      baseId,
    });

    for (const integration of integrations) {
      if (integration.isMeta()) {
        delete integration.config;
      }
    }

    return new PagedResponseImpl(integrations, {
      count: integrations.length,
      limit: integrations.length,
    });
  }
}
