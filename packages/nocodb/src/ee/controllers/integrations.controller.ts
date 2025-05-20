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
import axios from 'axios';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { IntegrationsService } from '~/services/integrations.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { Integration } from '~/models';
import { NcError } from '~/helpers/catchError';
import { maskKnexConfig } from '~/helpers/responseHelpers';

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
      throw new Error('Integration not found!');
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
      throw new Error('Integration not found!');
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

  @Post(['/api/v2/workspaces/:workspaceId/remote-fetch'])
  @Acl('integrationList', {
    scope: 'workspace',
    extendedScope: 'base',
  })
  async remoteFetch(
    @Param('workspaceId') workspaceId: string,
    @Body()
    body: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string;
    },
  ) {
    const integrationConfigMap = new Map();

    const getIntegrationConfig = async (integrationId, path) => {
      let config;

      if (!integrationConfigMap.has(integrationId)) {
        const integration = await Integration.get(
          {
            workspace_id: workspaceId,
          },
          integrationId,
        );

        config = integration.getConfig();

        if (!config) {
          NcError.integrationNotFound(integrationId);
        }

        integrationConfigMap.set(integrationId, config);
      } else {
        config = integrationConfigMap.get(integrationId);
      }

      // get nested value
      return path.split('.').reduce((o, i) => o[i], config);
    };

    const replaceWithConfig = async (str) => {
      if (typeof str !== 'string') return str;
      const matches = str.match(/{{(.*?)}}/g);
      if (!matches) return str;

      for (const match of matches) {
        const fullPath = match.replace(/{{|}}/g, '');
        const pathHelper = fullPath.split('.');
        const integrationId = pathHelper.shift();
        const path = pathHelper.join('.');
        const config = await getIntegrationConfig(integrationId, path);

        if (!config) {
          NcError.badRequest('Requested config not found');
        }

        str = str.replace(match, config);
      }

      return str;
    };

    try {
      const url = await replaceWithConfig(body.url);
      const method = await replaceWithConfig(body.method);
      // replace every value in headers
      const headers = {};

      for (const key in body.headers) {
        headers[key] = await replaceWithConfig(body.headers[key]);
      }

      const reqBody = await replaceWithConfig(body.body);

      const response = await axios({
        url,
        method,
        headers,
        data: reqBody,
      });

      return response.data;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
