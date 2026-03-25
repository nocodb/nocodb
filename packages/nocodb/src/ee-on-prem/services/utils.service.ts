import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UtilsService as UtilsServiceEE } from 'src/ee/services/utils.service';
import type { AppConfig } from '~/interface/config';
import Noco from '~/Noco';
import NocoLicense from '~/NocoLicense';
import { NC_IFRAME_WHITELIST_DOMAINS } from '~/utils/nc-config';

@Injectable()
export class UtilsService extends UtilsServiceEE {
  constructor(protected readonly configService: ConfigService<AppConfig>) {
    super(configService);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const result: any = await super.appInfo(param);

    result.isOnPrem = true;
    result.isTrial = NocoLicense.isTrial();
    result.isTrialExpired = NocoLicense.isExpired;

    const expiry = NocoLicense.getExpiry();
    result.licenseExpiryTime = expiry
      ? Math.floor(expiry.getTime() / 1000)
      : undefined;
    result.iframeWhitelistDomains = NC_IFRAME_WHITELIST_DOMAINS.split(',');
    result.defaultWorkspaceId = Noco.ncDefaultWorkspaceId || null;
    result.isAirgapped = NocoLicense.isAirgapped;
    result.seatLimit = NocoLicense.getSeatLimit();
    result.isPostgres = Noco.getConfig()?.meta?.db?.client === 'pg';

    return result;
  }
}
