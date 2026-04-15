import { SetMetadata, UseGuards } from '@nestjs/common';
import type { PlanFeatureTypes } from 'nocodb-sdk';
import { LICENSE_FEATURE_KEY, LicenseGuard } from '~/guards/license.guard';

/**
 * @License decorator for EE-only controller methods.
 *
 * In the unified build, all EE controllers are always registered.
 * This decorator gates access at runtime based on OnPremPlanDefinitions.
 *
 * @param feature - PlanFeatureTypes value. The LicenseGuard checks
 *                  plan.meta[feature] — if false, the endpoint is blocked.
 *
 * @example
 * ```ts
 * @License(PlanFeatureTypes.FEATURE_SSO)
 * @Acl('workspaceList', { scope: 'org' })
 * @Get('/api/v1/workspaces')
 * async workspaceList() { ... }
 * ```
 */
export const License =
  (feature: PlanFeatureTypes) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(LICENSE_FEATURE_KEY, feature)(target, key, descriptor);
    UseGuards(LicenseGuard)(target, key, descriptor);
  };
