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
import { checkForFeature } from '~/helpers/paymentHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScimConfigController {
  constructor(private readonly scimConfigService: ScimConfigService) {}

  private async checkScimFeature(context: NcContext, orgId: string) {
    // SCIM is a paid add-on on both ladders — FEATURE_SCIM resolves true only
    // when the add-on is active (merged into plan meta from the junction on
    // cloud / the license `config.addons` claim on-prem). Enforce it here so
    // the entitlement isn't client-side-only.
    await checkForFeature(
      { ...context, workspace_id: orgId },
      PlanFeatureTypes.FEATURE_SCIM,
    );
  }

  @Get('/api/v3/meta/orgs/:orgId/scim/config')
  @Acl('scimConfigGet', {
    scope: 'cloud-org',
  })
  async getConfig(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context, orgId);
    return this.scimConfigService.getConfig(context, orgId, {
      ncSiteUrl: req.ncSiteUrl,
    });
  }

  @Post('/api/v3/meta/orgs/:orgId/scim/config')
  @HttpCode(200)
  @Acl('scimConfigCreate', {
    scope: 'cloud-org',
  })
  async initializeConfig(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context, orgId);
    return this.scimConfigService.initializeConfig(context, {
      orgId,
      ncSiteUrl: req.ncSiteUrl,
      req,
    });
  }

  @Post('/api/v3/meta/orgs/:orgId/scim/config/token/regenerate')
  @HttpCode(200)
  @Acl('scimConfigUpdate', {
    scope: 'cloud-org',
  })
  async regenerateToken(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context, orgId);
    return this.scimConfigService.regenerateToken(context, orgId, req);
  }

  @Patch('/api/v3/meta/orgs/:orgId/scim/config')
  @Acl('scimConfigUpdate', {
    scope: 'cloud-org',
  })
  async updateConfig(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Body()
    config: {
      enabled?: boolean;
      role_mapping?: Record<string, any>;
      default_role?: string;
    },
    @Req() req: any,
  ) {
    await this.checkScimFeature(context, orgId);
    return this.scimConfigService.updateConfig(context, {
      orgId,
      ncSiteUrl: req.ncSiteUrl,
      req,
      config,
    });
  }

  @Delete('/api/v3/meta/orgs/:orgId/scim/config')
  @Acl('scimConfigDelete', {
    scope: 'cloud-org',
  })
  async deleteConfig(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context, orgId);
    return this.scimConfigService.deleteConfig(context, orgId, req);
  }
}
