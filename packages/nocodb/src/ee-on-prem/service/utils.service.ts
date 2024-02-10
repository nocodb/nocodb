import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UtilsService as UtilsServiceEE } from 'src/ee/services/utils.service';
import type { AppConfig } from '~/interface/config';
import { LicenseService } from '~/service/license/license.service';

@Injectable()
export class UtilsService extends UtilsServiceEE {
  constructor(
    protected readonly configService: ConfigService<AppConfig>,
    protected readonly licenseService: LicenseService,
  ) {
    super(configService);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const result: any = await super.appInfo(param);

    result.baseUrl = this.licenseService.getLicenseData()?.siteUrl;

    return result;
  }
}
