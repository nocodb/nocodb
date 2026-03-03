import { PlanFeatureTypes, PlanTitles } from 'src/lib/payment';

export * from 'src/lib/payment';

export const PlanFeatureTypesToPlanTitles: Record<
  PlanFeatureTypes,
  PlanTitles
> = {
  // Free features
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: PlanTitles.FREE,
  [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: PlanTitles.FREE,
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: PlanTitles.FREE,
  [PlanFeatureTypes.FEATURE_AI_CHAT]: PlanTitles.PLUS,

  // Plus features
  [PlanFeatureTypes.FEATURE_AI]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_AT_MENTION]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_EXTENSIONS]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FILE_MODE]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_SUBMIT_LABEL]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_ROW_COLOUR]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_CALENDAR_RANGE]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_AI_BUTTON_FIELD]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_COLOUR_FIELD]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_TOGGLE_FILTER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_PINNED_FILTER]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_UUID_FIELD]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_AUTONUMBER_FIELD]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_RECORD_TEMPLATES]: PlanTitles.PLUS,
  [PlanFeatureTypes.FEATURE_CUSTOM_URL]: PlanTitles.PLUS,

  // Business features
  [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_CELL_COLOUR]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT]: PlanTitles.BUSINESS, // Todo: discuss
  [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_API_VIEW_V3]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_SYNC]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_UNIQUE]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_RLS]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_MAP_VIEW]: PlanTitles.BUSINESS,
  [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: PlanTitles.BUSINESS,

  // Enterprise features
  [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: PlanTitles.ENTERPRISE,
  [PlanFeatureTypes.FEATURE_SSO]: PlanTitles.ENTERPRISE,
  [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS]: PlanTitles.ENTERPRISE,
  [PlanFeatureTypes.FEATURE_SCIM]: PlanTitles.ENTERPRISE,
};

export const PlanFeatureTypesToPlanTitlesEeCloud = {
  ...PlanFeatureTypesToPlanTitles,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: PlanTitles.FREE,
} as Record<PlanFeatureTypes, PlanTitles>;
