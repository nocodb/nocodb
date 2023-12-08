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
import { OrgLcenseService } from '~/services/org-lcense.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgLcenseController {
  constructor(private readonly orgLcenseService: OrgLcenseService) {}

  @Get('/api/v1/license')
  @Acl('licenseGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async licenseGet() {
    return await this.orgLcenseService.licenseGet();
  }

  @Post('/api/v1/license')
  @HttpCode(200)
  @Acl('licenseSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async licenseSet(@Body() body) {
    await this.orgLcenseService.licenseSet({ key: body.key });
    return { msg: 'The license key has been saved' };
  }
}
