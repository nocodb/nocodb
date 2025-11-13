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
import { IntegrationReqType, IntegrationsType, NcApiVersion } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { IntegrationsService } from '~/services/integrations.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { Integration } from '~/models';
import { maskKnexConfig } from '~/helpers/responseHelpers';
import { NcError } from '~/helpers/ncError';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationGet', {
    scope: 'workspace',
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

    if (integration.type === IntegrationsType.Database) {
      maskKnexConfig(integration);
    }

    return integration;
  }
  @Post(['/api/v2/meta/workspaces/:workspaceId/integrations'])
  @Acl('integrationCreate', {
    scope: 'workspace',
  })
  async integrationCreate(
    @TenantContext() context: NcContext,
    @Body() integration: IntegrationReqType,
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
  ) {
    return await this.integrationsService.integrationCreate(context, {
      integration,
      req,
      workspaceId,
    });
  }

  @Delete(['/api/v2/meta/integrations/:integrationId'])
  @Acl('integrationDelete', {
    scope: 'workspace',
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
    scope: 'workspace',
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

  @Patch(['/api/v2/meta/integrations/:integrationId/default'])
  @Acl('integrationUpdate', {
    scope: 'workspace',
  })
  async integrationSetDefault(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Req() req: NcRequest,
  ) {
    const integration = await this.integrationsService.integrationSetDefault(
      context,
      {
        integrationId,
        req,
      },
    );

    return integration;
  }

  @Get(['/api/v2/meta/workspaces/:workspaceId/integrations'])
  @Acl('integrationList', {
    scope: 'workspace',
    extendedScope: 'base',
  })
  async integrationList(
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
    @Query('type') type: IntegrationsType,
    @Query('includeDatabaseInfo') includeDatabaseInfo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('query') query?: string,
  ) {
    const integrations = await this.integrationsService.integrationList({
      workspaceId,
      req,
      includeDatabaseInfo: includeDatabaseInfo === 'true',
      type,
      query,
    });

    if (!includeDatabaseInfo) {
      for (const integration of integrations.list) {
        integration.config = undefined;
      }
    }

    return integrations;
  }

  @Get(['/api/v2/integrations'])
  async availableIntegrations() {
    return Integration.availableIntegrations
      .sort((a, b) => a.type.localeCompare(b.type))
      .sort((a, b) => a.sub_type.localeCompare(b.sub_type))
      .map((i) => ({
        type: i.type,
        sub_type: i.sub_type,
        manifest: i.manifest,
      }));
  }

  @Get(['/api/v2/integrations/:type/:subType'])
  async getIntegrationMeta(
    @Param('type') type: IntegrationsType,
    @Param('subType') subType: string,
  ) {
    const integration = Integration.availableIntegrations.find(
      (i) => i.type === type && i.sub_type === subType,
    );

    if (!integration) {
      NcError.get({
        api_version: NcApiVersion.V2,
      }).integrationNotFound(`${type}:${subType}`);
    }

    return {
      integrationType: integration.type,
      integrationSubType: integration.sub_type,
      form: integration.form,
      manifest: integration.manifest,
    };
  }

  @Post(['/api/v2/integrations/:integrationId/store'])
  @Acl('integrationStore', {
    scope: 'workspace',
    extendedScope: 'base',
  })
  async storeIntegration(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Body()
    payload?:
      | {
          op: 'list';
          limit: number;
          offset: number;
        }
      | {
          op: 'get';
        }
      | {
          op: 'sum';
          fields: string[];
        },
  ) {
    const integration = await Integration.get(context, integrationId);

    if (!integration) {
      NcError.get(context).integrationNotFound(integrationId);
    }

    return await this.integrationsService.integrationStore(
      context,
      integration,
      payload,
    );
  }

  @Post(['/api/v2/integrations/:integrationId/:endpoint'])
  @Acl('integrationEndpointGet', {
    scope: 'workspace',
    extendedScope: 'base',
  })
  async integrationEndpointGet(
    @TenantContext() context: NcContext,
    @Param('integrationId') integrationId: string,
    @Param('endpoint') endpoint: string,
    @Body() body: any,
  ) {
    return await this.integrationsService.callIntegrationEndpoint(context, {
      integrationId,
      endpoint,
      payload: body,
    });
  }
}
