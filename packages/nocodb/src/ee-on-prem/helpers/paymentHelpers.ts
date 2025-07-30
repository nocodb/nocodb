import type { Workspace } from '~/models';
import Noco from '~/Noco';
import { LicenseService } from '~/services/license/license.service';
import { EnterprisePlan, EnterpriseStarterPlan, FreePlan } from '~/models/Plan';

export * from 'src/ee/helpers/paymentHelpers';

const getOnPremPlan = () => {
  const licenseSevice = Noco.nestApp.get(LicenseService);

  if (!licenseSevice) {
    return FreePlan;
  }

  if (licenseSevice.getMaxWorkspaces() === 1) {
    return EnterpriseStarterPlan;
  }

  return EnterprisePlan;
};

export async function getActivePlanAndSubscription(
  _workspace: Workspace,
  _ncMeta = Noco.ncMeta,
) {
  const plan = getOnPremPlan();

  return { plan };
}
