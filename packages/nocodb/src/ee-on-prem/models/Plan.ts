import {
  OnPremPlanDefinitions,
  OnPremPlanTitles,
  PlanFeatureTypes,
  PlanTitles,
} from 'nocodb-sdk';
import Plan from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

// ── Helper: build a plan constant from OnPremPlanDefinitions ──────────

function buildOnPremPlan(title: OnPremPlanTitles) {
  const def = OnPremPlanDefinitions[title];
  return Plan.prepare({
    title,
    description: `${title} plan`,
    meta: {
      ...Plan.limitPairs(-1, false),
      ...Plan.featurePairs(true),
      ...(def?.features ?? {}),
      ...(def?.limits ?? {}),
    },
    free: false,
  });
}

// ── On-prem plan constants (derived from SDK OnPremPlanDefinitions) ──────

export const BusinessPlan = buildOnPremPlan(
  OnPremPlanTitles.SELF_HOSTED_BUSINESS,
);
export const ScalePlan = buildOnPremPlan(OnPremPlanTitles.SELF_HOSTED_SCALE);
export const EnterprisePlan = buildOnPremPlan(
  OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
);

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
