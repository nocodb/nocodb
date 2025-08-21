import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk';
import Plan from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

export const EnterpriseStarterPlan = Plan.prepare({
  title: PlanTitles.ENTERPRISE_STARTER,
  description: 'Enterprise starter plan',
  meta: {
    ...Plan.limitPairs(-1, false),
    ...Plan.featurePairs(true),
    [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
  },
  free: false,
});

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'On-premise plan',
  meta: {
    ...Plan.limitPairs(-1, false),
    ...Plan.featurePairs(true),
    [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
  },
  free: false,
});

export const EnterprisePlan = Plan.prepare({
  title: PlanTitles.ENTERPRISE,
  description: 'Enterprise plan',
  meta: {
    ...Plan.limitPairs(-1, false),
    ...Plan.featurePairs(true),
  },
  free: false,
});
