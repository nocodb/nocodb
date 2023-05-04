import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '../guards/global/global.guard';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { OrgLcenseService } from '../services/org-lcense.service';

@Controller()
@UseGuards(GlobalGuard)
export class OrgLcenseController {
  constructor(private readonly orgLcenseService: OrgLcenseService) {}

  @Get('/api/v1/license')
  @Acl('licenseGet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async licenseGet() {
    return await this.orgLcenseService.licenseGet();
  }

  @Post('/api/v1/license')
  @HttpCode(200)
  @Acl('licenseSet', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async licenseSet(@Body() body) {
    await this.orgLcenseService.licenseSet({ key: body.key });
    return { msg: 'The license key has been saved' };
  }
}
