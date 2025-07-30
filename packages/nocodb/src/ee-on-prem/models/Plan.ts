import { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import Plan from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

export const EnterpriseStarterPlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'On-premise starter plan',
  meta: {
    ...(Object.fromEntries(
      Object.values(PlanLimitTypes).map((limit) => [limit, -1]),
    ) as Record<PlanLimitTypes, number>),
    ...(Object.fromEntries(
      Object.values(PlanFeatureTypes).map((feature) => [feature, true]),
    ) as Record<PlanFeatureTypes, boolean>),
    [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
  },
  free: false,
});

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'On-premise plan',
  meta: {
    ...(Object.fromEntries(
      Object.values(PlanLimitTypes).map((limit) => [limit, -1]),
    ) as Record<PlanLimitTypes, number>),
    ...(Object.fromEntries(
      Object.values(PlanFeatureTypes).map((feature) => [feature, true]),
    ) as Record<PlanFeatureTypes, boolean>),
    [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
  },
  free: false,
});


export const EnterprisePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'On-premise plan',
  meta: {
    ...(Object.fromEntries(
      Object.values(PlanLimitTypes).map((limit) => [limit, -1]),
    ) as Record<PlanLimitTypes, number>),
    ...(Object.fromEntries(
      Object.values(PlanFeatureTypes).map((feature) => [feature, true]),
    ) as Record<PlanFeatureTypes, boolean>),
  },
  free: false,
});
