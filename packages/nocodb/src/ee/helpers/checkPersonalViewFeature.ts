import { PlanFeatureTypes, ViewLockType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { checkForFeature } from '~/helpers/paymentHelpers';

/**
 * EE override. Blocks creating / converting-to a Personal view when
 * the workspace (cloud) or on-prem plan doesn't include
 * `FEATURE_PERSONAL_VIEWS`.
 *
 * Called from views.service.ts (update path) and each *ViewCreate
 * service. No-op for non-Personal lock_types so collaborative and
 * locked flows are untouched.
 */
export async function assertPersonalViewAllowed(
  context: NcContext,
  lockType?: string,
) {
  // `ViewLockType.Personal` === `'personal'` — safe to compare against
  // a raw string because the enum values ARE strings.
  if (lockType !== ViewLockType.Personal) return;
  await checkForFeature(context, PlanFeatureTypes.FEATURE_PERSONAL_VIEWS);
}
