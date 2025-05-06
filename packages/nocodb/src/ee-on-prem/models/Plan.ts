import { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import Plan, { GenericLimits } from '~/ee/models/Plan';

export * from '~/ee/models/Plan';
export default Plan;

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'On-premise plan',
  meta: {
    ...GenericLimits,
    [PlanLimitTypes.LIMIT_EDITOR]: -1,
    [PlanLimitTypes.LIMIT_COMMENTER]: -1,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: -1,
    [PlanLimitTypes.LIMIT_API_CALL]: -1,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: -1,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: -1,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: -1,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: -1,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: -1,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
    [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: -1,
    [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: -1,
    [PlanLimitTypes.LIMIT_AI_TOKEN]: -1,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: -1,
    [PlanFeatureTypes.FEATURE_AI]: true,
    [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: true,
    [PlanFeatureTypes.FEATURE_AT_MENTION]: true,
    [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: true,
    [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: true,
    [PlanFeatureTypes.FEATURE_CUSTOM_URL]: true,
    [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: true,
    [PlanFeatureTypes.FEATURE_EXTENSIONS]: true,
    [PlanFeatureTypes.FEATURE_FILE_MODE]: true,
    [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: true,
    [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: true,
    [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: true,
    [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: true,
    [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: true,
    [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: true,
    [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: true,
    [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: true,
    [PlanFeatureTypes.FEATURE_SCRIPTS]: true,
    [PlanFeatureTypes.FEATURE_SSO]: true,
    [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: true,
    [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: true,
  },
  free: false,
});
