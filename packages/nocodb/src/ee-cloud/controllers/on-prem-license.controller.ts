import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { NcRequest } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { OnPremLicenseService } from '~/services/on-prem-license.service';

@Controller()
export class OnPremLicenseController {
  constructor(private readonly onPremLicenseService: OnPremLicenseService) {}

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/on-premise/licenses')
  @Acl('onPremLicenseList', { scope: 'org' })
  async listLicenses(@Req() req: NcRequest) {
    return this.onPremLicenseService.listLicenses(req.user.id);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/on-premise/licenses/:licenseId')
  @Acl('onPremLicenseGet', { scope: 'org' })
  async getLicense(
    @Param('licenseId') licenseId: string,
    @Req() req: NcRequest,
  ) {
    return this.onPremLicenseService.getLicense(licenseId, req.user.id);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/on-premise/sync')
  @Acl('onPremLicenseList', { scope: 'org' })
  async syncLicenses(@Req() req: NcRequest) {
    const synced = await this.onPremLicenseService.syncLicenses(req.user.id);
    return { synced };
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Post('/api/payment/on-premise/create-checkout')
  @Acl('onPremLicenseCheckout', { scope: 'org' })
  async createCheckout(
    @Body()
    payload: {
      plan_id: string;
      price_id: string;
      instance_url?: string;
    },
    @Req() req: NcRequest,
  ) {
    return this.onPremLicenseService.createCheckoutSession(payload, req);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/on-premise/get-session-result/:sessionId')
  @Acl('onPremLicenseGet', { scope: 'org' })
  async getCheckoutSession(
    @Param('sessionId') sessionId: string,
    @Req() req: NcRequest,
  ) {
    return this.onPremLicenseService.getCheckoutSession(sessionId, req.user.id);
  }

  @UseGuards(GlobalGuard)
  @HttpCode(200)
  @Get('/api/payment/on-premise/customer-portal')
  @Acl('onPremLicenseManage', { scope: 'org' })
  async getCustomerPortal(@Req() req: NcRequest) {
    return this.onPremLicenseService.getCustomerPortal(req.user.id, req);
  }
}
