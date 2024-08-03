import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType, IntegrationReqType } from 'nocodb-sdk';
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

  @Get(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationGet')
  async integrationGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
  ) {
    const integration = await this.integrationsService.integrationGetWithConfig(
      context,
      {
        integrationId,
      },
    );

    delete integration.config;

    return integration;
  }
  @Post(['/api/v2/meta/workspaces/:workspaceId/integrations'])
  @Acl('integrationCreate')
  async integrationCreate(
    @Body() integration: IntegrationReqType,
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
  ) {
    return await this.integrationsService.integrationCreate({
      integration,
      req,
      workspaceId,
    });
  }

  @Delete(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationDelete')
  async integrationDelete(
    @Param('integrationId') integrationId: string,
    @Req() req: NcRequest,
  ) {
    return await this.integrationsService.integrationDelete({
      req,
      integrationId,
    });
  }

  @Patch(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationUpdate')
  async integrationUpdate(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Body() body: BaseReqType,
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

  @Get(['/api/v2/meta/workspaces/:workspaceId/integrations'])
  @Acl('integrationList')
  async integrationList(@Param('workspaceId') workspaceId: string) {
    const integrations = await this.integrationsService.integrationList({
      workspaceId,
    });

    for (const integration of integrations) {
      delete integration.config;
    }

    return new PagedResponseImpl(integrations, {
      count: integrations.length,
      limit: integrations.length,
    });
  }
}
