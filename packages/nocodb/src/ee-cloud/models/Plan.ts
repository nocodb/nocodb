import { PlanFeatureTypes, PlanTitles, resolvePlanMeta } from 'nocodb-sdk';
import Plan from 'src/ee/models/Plan';

export * from 'src/ee/models/Plan';
export default Plan;

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'Free plan',
  meta: {
    ...resolvePlanMeta(PlanTitles.FREE),
    ...(process.env.NODE_ENV === 'test'
      ? {
          [PlanFeatureTypes.FEATURE_SSO]: true,
          [PlanFeatureTypes.FEATURE_SCIM]: true,
        }
      : {}),
  },
  free: true,
});
