import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { PlanFeatureTypes } from 'nocodb-sdk';
import NocoLicense from '~/NocoLicense';
import { NcError } from '~/helpers/catchError';
import { getOnPremPlan } from '~/helpers/paymentHelpers';

// Re-export so @License decorator can import from ~/guards/license.guard
export { LICENSE_FEATURE_KEY } from 'src/ee/guards/license.guard';

/**
 * On-prem plan-aware LicenseGuard.
 *
 * All gating decisions flow from OnPremPlanDefinitions (single source of truth).
 * @License(PlanFeatureTypes.X) passes the feature type directly — no mapping.
 * The guard checks plan.meta[feature]:
 *   - true  → allow
 *   - false → reject (planLimitExceeded for licensed, licenseRequired for unlicensed)
 *
 * Resolution chain (tsconfig paths):
 *   ~/guards/license.guard → ee-on-prem/guards/license.guard (this file)
 */
@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (NocoLicense.shouldBlockAccess()) {
      NcError.licenseSuspended();
    }

    const feature = this.reflector.getAllAndOverride<PlanFeatureTypes>(
      'license_feature',
      [context.getHandler(), context.getClass()],
    );

    if (!feature) return true;

    const plan = getOnPremPlan();

    if (plan?.meta?.[feature] === false) {
      if (NocoLicense.isEE) {
        NcError.planLimitExceeded(`This feature requires a higher plan.`, {
          plan: plan?.title,
          limit: 0,
          current: 0,
        });
      } else {
        NcError.licenseRequired(feature);
      }
    }

    return true;
  }
}
