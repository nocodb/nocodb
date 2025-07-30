import { PlanTitles } from 'nocodb-sdk';
import type { PlanFeatureTypes } from 'nocodb-sdk';
import type { Workspace } from '~/models';
import Noco from '~/Noco';
import { LicenseService } from '~/services/license/license.service';
import {
  EnterprisePlan,
  EnterpriseStarterPlan,
  GenericFeatures,
} from '~/models/Plan';

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

export async function getFeature(
  type: PlanFeatureTypes,
  workspaceOrId?: string | Workspace,
  ncMeta = Noco.ncMeta,
) {
  const plan = getOnPremPlan();

  if (plan === PlanTitles.ENTERPRISE) {
    return EnterprisePlan.meta?.[type] || GenericFeatures[type];
  }

  return EnterpriseStarterPlan.meta?.[type] || GenericFeatures[type];
}
