import { PlanFeatureTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

/**
 * Plan gate for global search (all-fields grid search, ⌘K record search) and
 * the indexes behind it. CE stub: never allowed. EE shadows this file.
 */
export async function isGlobalSearchAllowed(
  _context: NcContext,
): Promise<boolean> {
  return false;
}

export async function assertGlobalSearchAllowed(
  context: NcContext,
): Promise<void> {
  NcError.get(context).featureNotSupported({
    feature: PlanFeatureTypes.FEATURE_GLOBAL_SEARCH,
  });
}
