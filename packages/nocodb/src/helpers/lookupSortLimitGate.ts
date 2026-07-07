import { PlanFeatureTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

/**
 * License gate for the per-lookup Sort + Limit feature (paid, EE-only).
 *
 * This is the CE stub: the feature does not exist in OSS/CE, so the read gate is
 * always `false` and the write assertion always rejects. EE shadows this file
 * (`src/ee/helpers/lookupSortLimitGate.ts`) with the real plan/license check.
 *
 * Every consumer (display / filter / formula / sort / group-by) resolves the
 * read gate through `loadLookupSortAndLimit`, and every write path
 * (`lookupSortCreate`, `meta.lookup_limit`) calls the assertion. Routing them
 * all through this single gate keeps them consistent: config can never be
 * created or take effect without a license, and on a plan downgrade the whole
 * feature reverts at once (no display/filter divergence).
 */
export async function isLookupSortLimitLicensed(
  _context: NcContext,
): Promise<boolean> {
  return false;
}

export async function assertLookupSortLimitLicensed(
  context: NcContext,
): Promise<void> {
  NcError.get(context).featureNotSupported({
    feature: PlanFeatureTypes.FEATURE_LOOKUP_SORT_LIMIT,
  });
}
