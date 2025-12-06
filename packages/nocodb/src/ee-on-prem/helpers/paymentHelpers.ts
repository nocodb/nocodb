import NocoLicense from '~/NocoLicense';
import { EnterprisePlan, EnterpriseStarterPlan, FreePlan } from '~/models/Plan';
import Noco from '~/Noco';

export * from 'src/ee/helpers/paymentHelpers';

export const getOnPremPlan = () => {
  try {
    if (NocoLicense.getWorkspaceLimit() === 1) {
      return EnterpriseStarterPlan;
    }

    return EnterprisePlan;
  } catch {
    return FreePlan;
  }
};

export async function getActivePlanAndSubscription(
  _workspaceOrOrgId: string,
  _loyal = false,
  _ncMeta = Noco.ncMeta,
) {
  const plan = getOnPremPlan();

  return { plan };
}
