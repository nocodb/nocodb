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
import { AppEvents } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { ScimConfigService } from '~/ee/services/scim/scim-config.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ScimConfigController {
  constructor(
    private readonly scimConfigService: ScimConfigService,
    private readonly appHooksService: AppHooksService,
  ) {}

  private async checkScimFeature(_context: NcContext) {
    // SCIM is available on licensed on-prem (license checked by LicenseGuard)
    // and on cloud enterprise orgs. No workspace-level plan check needed
    // since SCIM is now org-scoped.
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
    await this.checkScimFeature(context);
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
    await this.checkScimFeature(context);
    const result = await this.scimConfigService.initializeConfig(context, {
      orgId,
      ncSiteUrl: req.ncSiteUrl,
    });

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_CREATE as any, {
      orgId,
      req,
    });

    return result;
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
    await this.checkScimFeature(context);
    const result = await this.scimConfigService.regenerateToken(context, orgId);

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_TOKEN_REGENERATE as any, {
      orgId,
      req,
    });

    return result;
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
    await this.checkScimFeature(context);
    const result = await this.scimConfigService.updateConfig(context, {
      orgId,
      ncSiteUrl: req.ncSiteUrl,
      config,
    });

    if (config.enabled === false) {
      this.appHooksService.emit(AppEvents.SCIM_CONFIG_DISABLE as any, {
        orgId,
        req,
      });
    } else {
      this.appHooksService.emit(AppEvents.SCIM_CONFIG_UPDATE as any, {
        orgId,
        req,
      });
    }

    return result;
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
    await this.checkScimFeature(context);
    const result = await this.scimConfigService.deleteConfig(context, orgId);

    this.appHooksService.emit(AppEvents.SCIM_CONFIG_DELETE as any, {
      orgId,
      req,
    });

    return result;
  }
}
