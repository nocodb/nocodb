import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import NocoLicense from '~/NocoLicense';
import { isOnPrem } from '~/utils';
import { NcError } from '~/helpers/catchError';

export const LICENSE_FEATURE_KEY = 'license_feature';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // If license is explicitly suspended/revoked, block EE endpoints
    if (NocoLicense.shouldBlockAccess()) {
      NcError.licenseSuspended();
    }

    // If EE features are active (licensed), allow the request
    if (NocoLicense.isEE) {
      return true;
    }

    // On-prem without license: allow workspace endpoints (core feature)
    // SSO, teams, snapshots etc. stay gated (different feature strings)
    if (isOnPrem) {
      const feature = this.reflector.getAllAndOverride<string>(
        LICENSE_FEATURE_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (feature === 'workspaces') return true;
    }

    const feature = this.reflector.get<string>(
      LICENSE_FEATURE_KEY,
      context.getHandler(),
    );

    NcError.licenseRequired(feature);
  }
}
