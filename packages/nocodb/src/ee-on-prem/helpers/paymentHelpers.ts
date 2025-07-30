import { PlanTitles } from 'nocodb-sdk';
import type { Workspace } from '~/models';
import Noco from '~/Noco';
import { LicenseService } from '~/services/license/license.service';

export * from 'src/ee/helpers/paymentHelpers';

const getOnPremPlan = () => {
  const licenseSevice = Noco.nestApp.get(LicenseService);

  if (!licenseSevice) {
    return PlanTitles.FREE;
  }

  if (licenseSevice.getOneWorkspace()) {
    return PlanTitles.ENTERPRISE_STARTER;
  }

  return PlanTitles.ENTERPRISE;
};

export async function getActivePlanAndSubscription(
  _workspace: Workspace,
  _ncMeta = Noco.ncMeta,
) {
  const plan = getOnPremPlan();

  return { plan };
}
