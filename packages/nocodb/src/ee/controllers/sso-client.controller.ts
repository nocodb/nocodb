import {
  Body,
  Controller,
  Delete, Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { SSOClientType } from 'nocodb-sdk';
import { SSOClientService } from '~/services/sso-client.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';

// todo:
// 1. add acl
// 2. add pagination if required

@Controller()
export class SsoClientController {
  constructor(private readonly ssoClientService: SSOClientService) {}

  @Get('/api/v2/sso-client')
  async clientList(@Req() req) {
    const clients = await this.ssoClientService.clientList({req});
    return new PagedResponseImpl(clients);
  }

  @Post('/api/v2/sso-client')
  @HttpCode(200)
  async clientAdd(@Body() client: SSOClientType, @Req() req) {
    return this.ssoClientService.clientAdd({ client, req });
  }

  @Patch('/api/v2/sso-client/:clientId')
  async clientUpdate(
    @Param('clientId') clientId: string,
    @Body() client: SSOClientType,
    @Req() req,
  ) {
    return this.ssoClientService.clientUpdate({ clientId, client, req });
  }

  @Delete('/api/v2/sso-client/:clientId')
  async clientDelete(
    @Param('clientId') clientId: string,
    @Req() req,
  ) {
    return this.ssoClientService.clientDelete({ clientId, req });
  }
}
