import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { OrgLicenseService } from '~/services/org-license.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgLicenseController {
  constructor(private readonly orgLicenseService: OrgLicenseService) {}

  @Get('/api/v1/license')
  @Acl('licenseGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async licenseGet() {
    return await this.orgLicenseService.licenseGet();
  }

  @Post('/api/v1/license')
  @HttpCode(200)
  @Acl('licenseSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async licenseSet(@Body() body) {
    await this.orgLicenseService.licenseSet({ key: body.key });
    return { msg: 'The license key has been saved' };
  }

  @Get('/api/v1/license/status')
  @Acl('licenseGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async licenseStatus() {
    return await this.orgLicenseService.licenseStatus();
  }

  @Post('/api/v1/license/refresh')
  @HttpCode(200)
  @Acl('licenseSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async licenseRefresh() {
    return await this.orgLicenseService.licenseRefresh();
  }
}
