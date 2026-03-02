import {
  OnPremPlanTitles,
  PlanFeatureTypes,
  PlanLimitTypes,
  PlanTitles,
} from 'nocodb-sdk';
import Plan from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

// ── Legacy plan (backward compat for old JWTs without plan_title) ──────────

export const EnterpriseStarterPlan = Plan.prepare({
  title: OnPremPlanTitles.ENTERPRISE_STARTER,
  description: 'Enterprise starter plan (legacy)',
  meta: {
    ...Plan.limitPairs(-1, false),
    ...Plan.featurePairs(true),

    // Enterprise-only features (disabled in Starter per pricing_self_hosted.csv)
    [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
    [PlanFeatureTypes.FEATURE_SSO]: false,
    [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
    [PlanFeatureTypes.FEATURE_CELL_COLOUR]: false,
    [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: false,
    [PlanFeatureTypes.FEATURE_PINNED_FILTER]: false,
    [PlanFeatureTypes.FEATURE_TOGGLE_FILTER]: false,
    [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]: false,
    [PlanFeatureTypes.FEATURE_RLS]: false,
    [PlanFeatureTypes.FEATURE_SCIM]: false,
    [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,

    // Limits — Starter has no snapshots
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 0,
    [PlanLimitTypes.LIMIT_WORKSPACE]: 1,
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
