import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { ScimConfigService } from '~/ee/services/scim/scim-config.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { isCloud, isOnPrem } from '~/utils';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScimConfigController {
  constructor(private readonly scimConfigService: ScimConfigService) {}

  private async checkScimFeature(context: NcContext) {
    if (isCloud || isOnPrem) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_SCIM);
    }
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/config')
  @Acl('scimConfigGet', {
    scope: 'workspace',
  })
  async getConfig(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    return this.scimConfigService.getConfig(context, workspaceId, {
      ncSiteUrl: req.ncSiteUrl,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/scim/config')
  @HttpCode(200)
  @Acl('scimConfigCreate', {
    scope: 'workspace',
  })
  async initializeConfig(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    return this.scimConfigService.initializeConfig(context, {
      workspaceId,
      ncSiteUrl: req.ncSiteUrl,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/scim/config/token/regenerate')
  @HttpCode(200)
  @Acl('scimConfigUpdate', {
    scope: 'workspace',
  })
  async regenerateToken(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimConfigService.regenerateToken(context, workspaceId);
  }

  @Patch('/api/v3/meta/workspaces/:workspaceId/scim/config')
  @Acl('scimConfigUpdate', {
    scope: 'workspace',
  })
  async updateConfig(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() config: { enabled?: boolean; role_mapping?: Record<string, any> },
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    return this.scimConfigService.updateConfig(context, {
      workspaceId,
      ncSiteUrl: req.ncSiteUrl,
      config,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/scim/config')
  @Acl('scimConfigDelete', {
    scope: 'workspace',
  })
  async deleteConfig(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimConfigService.deleteConfig(context, workspaceId);
  }
}
