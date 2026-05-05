import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UtilsService as UtilsServiceEE } from 'src/ee/services/utils.service';
import type { AppConfig } from '~/interface/config';
import { getOnPremPlan } from '~/helpers/paymentHelpers';
import Noco from '~/Noco';
import NocoLicense from '~/NocoLicense';
import { NC_IFRAME_WHITELIST_DOMAINS } from '~/utils/nc-config';
import { LICENSE_ENV_VARS } from '~/utils/license';
import { isPlayWrightNode } from '~/helpers/utils';

const DEFAULT_LICENSE_SERVER_URL = 'https://app.nocodb.com';

// Hostname allowlist — exact match or subdomain of these.
const LICENSE_SERVER_HOST_ALLOWLIST = ['nocodb.com', 'nocopod.com'];

function isHostAllowed(hostname: string): boolean {
  return LICENSE_SERVER_HOST_ALLOWLIST.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

// Parse, validate (http/https + allowlisted host), and strip trailing slash.
// Falls back to the default if the configured value fails any check.
function resolveLicenseServerUrl(): string {
  const raw = process.env[LICENSE_ENV_VARS.LICENSE_SERVER_URL];
  if (!raw) return DEFAULT_LICENSE_SERVER_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
    if (!isPlayWrightNode() && !isHostAllowed(parsed.hostname)) {
      throw new Error(`Host not allowed: ${parsed.hostname}`);
    }
    return raw.replace(/\/+$/, '');
  } catch (e) {
    new Logger('UtilsService').warn(
      `Invalid ${LICENSE_ENV_VARS.LICENSE_SERVER_URL} (${raw}): ${
        (e as Error).message
      }. Falling back to ${DEFAULT_LICENSE_SERVER_URL}.`,
    );
    return DEFAULT_LICENSE_SERVER_URL;
  }
}

@Injectable()
export class UtilsService extends UtilsServiceEE {
  constructor(protected readonly configService: ConfigService<AppConfig>) {
    super(configService);
  }

  async appInfo(param: { req: { ncSiteUrl: string } }) {
    const result: any = await super.appInfo(param);

    result.isOnPrem = true;
    result.licenseServerUrl = resolveLicenseServerUrl();
    result.isTrial = NocoLicense.isTrial();
    result.isTrialExpired = NocoLicense.isExpired;

    const expiry = NocoLicense.getExpiry();
    result.licenseExpiryTime = expiry
      ? Math.floor(expiry.getTime() / 1000)
      : undefined;
    result.iframeWhitelistDomains = NC_IFRAME_WHITELIST_DOMAINS.split(',');
    result.defaultWorkspaceId = Noco.ncDefaultWorkspaceId || null;
    result.defaultOrgId = Noco.ncDefaultOrgId || null;
    result.isAirgapped = NocoLicense.isAirgapped;
    result.seatLimit = NocoLicense.getSeatLimit();
    result.isPostgres = Noco.getConfig()?.meta?.db?.client === 'pg';
    result.isLicenseKeySetByEnv = Noco.isInitialLicenseKeyFromEnv;

    // Instance-wide plan for on-prem — used by frontend for feature gating.
    // Always populated (including unlicensed/Free) so the frontend can check
    // which features are enabled on the current plan via OnPremPlanDefinitions.
    const plan = getOnPremPlan();
    result.onPremPlan = plan?.meta ?? null;
    result.onPremPlanTitle = plan?.title ?? null;

    return result;
  }
}
