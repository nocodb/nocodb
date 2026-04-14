import { OnPremPlanDefinitions, OnPremPlanTitles } from 'nocodb-sdk';
import Plan from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

// ── Helper: build a plan constant from OnPremPlanDefinitions ──────────

function buildOnPremPlan(title: OnPremPlanTitles) {
  const isFree = title === OnPremPlanTitles.FREE;
  const def = OnPremPlanDefinitions[title];
  return Plan.prepare({
    title,
    description: `${title} plan`,
    meta: {
      // Free = default-deny (limits 0, features false)
      // Paid = default-allow (limits -1/unlimited, features true)
      ...Plan.limitPairs(isFree ? 0 : -1, false),
      ...Plan.featurePairs(!isFree),
      ...(def?.features ?? {}),
      ...(def?.limits ?? {}),
    },
    free: false,
  });
}

// ── On-prem plan constants (derived from SDK OnPremPlanDefinitions) ──────

export const FreePlan = buildOnPremPlan(OnPremPlanTitles.FREE);
export const StarterPlan = buildOnPremPlan(
  OnPremPlanTitles.SELF_HOSTED_STARTER,
);
export const ScalePlan = buildOnPremPlan(OnPremPlanTitles.SELF_HOSTED_SCALE);
export const EnterprisePlan = buildOnPremPlan(
  OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
);
