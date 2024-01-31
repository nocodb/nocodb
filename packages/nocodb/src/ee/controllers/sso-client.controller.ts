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
} from '@nestjs/common';
import { OrgUserRoles, SSOClientType } from 'nocodb-sdk';
import { SSOClientService } from '~/services/sso-client.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
export class SsoClientController {
  constructor(private readonly ssoClientService: SSOClientService) {}

  @Get('/api/v2/sso-client')
  @Acl('ssoClientList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientList(@Req() req) {
    const clients = await this.ssoClientService.clientList({ req });
    return new PagedResponseImpl(clients);
  }

  @Post('/api/v2/sso-client')
  @Acl('ssoClientCreate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  @HttpCode(200)
  async clientAdd(@Body() client: SSOClientType, @Req() req) {
    return this.ssoClientService.clientAdd({ client, req });
  }

  @Patch('/api/v2/sso-client/:clientId')
  @Acl('ssoClientUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
  ) {
    return this.ssoClientService.clientUpdate({ clientId, client, req });
  }

  @Delete('/api/v2/sso-client/:clientId')
  @Acl('ssoClientDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async clientDelete(@Param('clientId') clientId: string, @Req() req) {
    return this.ssoClientService.clientDelete({ clientId, req });
  }
}
