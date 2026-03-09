import { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import Plan from 'src/ee/models/Plan';

export * from 'src/ee/models/Plan';
export default Plan;

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'Free plan',
  meta: {
    ...Plan.limitPairs(0),
    ...Plan.featurePairs(false),
    // Free plan specific limits
    [PlanLimitTypes.LIMIT_EDITOR]: 3,
    [PlanLimitTypes.LIMIT_COMMENTER]: 10,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000,
    [PlanLimitTypes.LIMIT_API_CALL]: 1000,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 0,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 14,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 1000,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
    [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: 50,
    [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 0,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 0,
    [PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE]: 1,
    [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: true,
    [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 1000,
    [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 15,
    [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 0,
    [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 256,
    [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]: false,
    ...(process.env.NODE_ENV === 'test'
      ? {
          [PlanFeatureTypes.FEATURE_SSO]: true,
          [PlanFeatureTypes.FEATURE_SCIM]: true,
        }
      : {}),
  },
  free: true,
});
