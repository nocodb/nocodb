export enum PlanLimitTypes {
  LIMIT_FREE_WORKSPACE = 'limit_free_workspace',
  LIMIT_EDITOR = 'limit_editor',
  LIMIT_COMMENTER = 'limit_commenter',

  LIMIT_API_PER_SECOND = 'limit_api_per_second',
  LIMIT_AI_TOKEN = 'limit_ai_token',
  LIMIT_API_CALL = 'limit_api_call',
  LIMIT_AUDIT_RETENTION = 'limit_audit_retention',
  LIMIT_AUTOMATION_RUN = 'limit_automation_run',
  LIMIT_AUTOMATION_RETENTION = 'limit_automation_retention',

  LIMIT_WEBHOOK_PER_WORKSPACE = 'limit_webhook',
  LIMIT_EXTENSION_PER_WORKSPACE = 'limit_extension',
  LIMIT_SNAPSHOT_PER_WORKSPACE = 'limit_snapshot',
  LIMIT_STORAGE_PER_WORKSPACE = 'limit_storage',
  LIMIT_RECORD_PER_WORKSPACE = 'limit_record',
  LIMIT_BASE_PER_WORKSPACE = 'limit_base',
  LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE = 'limit_external_source',
  LIMIT_TABLE_PER_BASE = 'limit_table_per_base',
  LIMIT_COLUMN_PER_TABLE = 'limit_column_per_table',
  LIMIT_WEBHOOK_PER_TABLE = 'limit_webhook_per_table',
  LIMIT_VIEW_PER_TABLE = 'limit_view_per_table',
  LIMIT_FILTER_PER_VIEW = 'limit_filter_per_view',
  LIMIT_SORT_PER_VIEW = 'limit_sort_per_view',
}

export enum PlanFeatureTypes {
  FEATURE_AI = 'feature_ai',
  FEATURE_AI_INTEGRATIONS = 'feature_ai_integrations',
  FEATURE_AT_MENTION = 'feature_at_mention',
  FEATURE_AUDIT_WORKSPACE = 'feature_audit_workspace',
  FEATURE_COMMENT_RESOLVE = 'feature_comment_resolve',
  FEATURE_CUSTOM_URL = 'feature_custom_url',
  FEATURE_DISCUSSION_MODE = 'feature_discussion_mode',
  FEATURE_EXTENSIONS = 'feature_extensions',
  FEATURE_FILE_MODE = 'feature_file_mode',
  FEATURE_FORM_URL_REDIRECTION = 'feature_form_url_redirection',
  FEATURE_FORM_CUSTOM_LOGO = 'feature_form_custom_logo',
  FEATURE_FORM_FIELD_ON_CONDITION = 'feature_form_field_on_condition',
  FEATURE_FORM_FIELD_VALIDATION = 'feature_form_field_validation',
  FEATURE_GROUP_BY_AGGREGATIONS = 'feature_group_by_aggregations',
  FEATURE_HIDE_BRANDING = 'feature_hide_branding',
  FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER = 'feature_ltar_limit_selection_by_filter',
  FEATURE_PERSONAL_VIEWS = 'feature_personal_views',
  FEATURE_SCRIPTS = 'feature_scripts',
  FEATURE_SSO = 'feature_sso',
  FEATURE_WEBHOOK_CUSTOM_PAYLOAD = 'feature_webhook_custom_payload',
  FEATURE_WORKSPACE_CUSTOM_LOGO = 'feature_workspace_custom_logo',
  FEATURE_CURRENT_USER_FILTER = 'feature_current_user_filter',
  FEATURE_WEBHOOK_SCHEDULED = 'feature_webhook_scheduled',
}

export enum PlanTitles {
  FREE = 'Free',
  TEAM = 'Team',
  BUSINESS = 'Business',
  ENTERPRISE = 'Enterprise',
}

export enum PlanPriceLookupKeys {
  TEAM_MONTHLY = 'team_monthly',
  TEAM_YEARLY = 'team_yearly',
  BUSINESS_MONTHLY = 'business_monthly',
  BUSINESS_YEARLY = 'business_yearly',
}

export const LoyaltyPriceLookupKeyMap = {
  [PlanPriceLookupKeys.TEAM_MONTHLY]: 'loyalty_team_monthly',
  [PlanPriceLookupKeys.TEAM_YEARLY]: 'loyalty_team_yearly',
  [PlanPriceLookupKeys.BUSINESS_MONTHLY]: 'loyalty_business_monthly',
  [PlanPriceLookupKeys.BUSINESS_YEARLY]: 'loyalty_business_yearly',
};

export const LoyaltyPriceReverseLookupKeyMap = {
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.TEAM_MONTHLY]]:
    PlanPriceLookupKeys.TEAM_MONTHLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.TEAM_YEARLY]]:
    PlanPriceLookupKeys.TEAM_YEARLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.BUSINESS_MONTHLY]]:
    PlanPriceLookupKeys.BUSINESS_MONTHLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.BUSINESS_YEARLY]]:
    PlanPriceLookupKeys.BUSINESS_YEARLY,
};

export const PlanMeta = {
  [PlanTitles.FREE]: {
    title: PlanTitles.FREE,
    color: '#F9F9FA',
    accent: '#E7E7E9',
    primary: '#1F293A',
    bgLight: '#F9F9FA',
    bgDark: '#F4F4F5',
    border: '#E7E7E9',
    chartFillColor: '#6A7184',
  },
  [PlanTitles.TEAM]: {
    title: PlanTitles.TEAM,
    color: '#EDF9FF',
    accent: '#AFE5FF',
    primary: '#207399',
    bgLight: '#EDF9FF',
    bgDark: '#D7F2FF',
    border: '#AFE5FF',
    chartFillColor: '#207399',
  },
  [PlanTitles.BUSINESS]: {
    title: PlanTitles.BUSINESS,
    color: '#FFF5EF',
    accent: '#FDCDAD',
    primary: '#C86827',
    bgLight: '#FFF5EF',
    bgDark: '#FEE6D6',
    border: '#FDCDAD',
    chartFillColor: '#C86827',
  },
  [PlanTitles.ENTERPRISE]: {
    title: PlanTitles.ENTERPRISE,
    color: '#0D1117',
    accent: '#663B1F',
    primary: '#C86827',
    bgLight: '#FFF5EF',
    bgDark: '#FEE6D6',
    border: '#FDCDAD',
    chartFillColor: '#C86827',
  },
} as const;

export const PlanOrder = {
  [PlanTitles.FREE]: 0,
  [PlanTitles.TEAM]: 1,
  [PlanTitles.BUSINESS]: 2,
  [PlanTitles.ENTERPRISE]: 3,
};

export const PlanOrderToPlan = Object.entries(PlanOrder).reduce(
  (acc, [plan, order]) => {
    acc[order] = plan as PlanTitles;
    return acc;
  },
  {} as Record<string, PlanTitles>
);

export const HigherPlan = {
  [PlanTitles.FREE]: PlanTitles.TEAM,
  [PlanTitles.TEAM]: PlanTitles.BUSINESS,
  [PlanTitles.BUSINESS]: PlanTitles.ENTERPRISE,
} as Record<string, PlanTitles>;

export const GRACE_PERIOD_DURATION = 14;

export const LOYALTY_GRACE_PERIOD_END_DATE = '2025-05-30';

export const SEAT_PRICE_CAP = 9;

export const LOYALTY_SEAT_PRICE_CAP = 4;

export const PlanLimitUpgradeMessages: Record<PlanLimitTypes, string> = {
  [PlanLimitTypes.LIMIT_FREE_WORKSPACE]: 'to add more workspaces.',
  [PlanLimitTypes.LIMIT_EDITOR]: 'to add more editors.',
  [PlanLimitTypes.LIMIT_COMMENTER]: 'to add more commenters.',
  [PlanLimitTypes.LIMIT_API_PER_SECOND]:
    'due to reaching the API per second limit.',
  [PlanLimitTypes.LIMIT_AI_TOKEN]: 'due to reaching the AI token usage limit.',
  [PlanLimitTypes.LIMIT_API_CALL]: 'due to reaching the API call limit.',
  [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 'to increase audit retention.',
  [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 'to run more automations.',
  [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]:
    'to increase automation retention.',
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: 'to add more webhooks.',
  [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: 'to add more extensions.',
  [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]:
    'due to reaching the snapshot limit.',
  [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]:
    'due to reaching the storage limit.',
  [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]:
    'as the record limit has been reached.',
  [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: 'to add more bases.',
  [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]:
    'to connect more external sources.',
  [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 'to add more tables in a base.',
  [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: 'to add more columns in a table.',
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: 'to add more table-level webhooks.',
  [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: 'to add more views in a table.',
  [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: 'to add more filters in a view.',
  [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: 'to add more sort rules in a view.',
};

export const PlanFeatureUpgradeMessages: Record<PlanFeatureTypes, string> = {
  [PlanFeatureTypes.FEATURE_AI]: 'to enable AI features.',
  [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: 'to use AI integrations.',
  [PlanFeatureTypes.FEATURE_AT_MENTION]: 'to use @mention in comments.',
  [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: 'to access workspace audit logs.',
  [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: 'to enable comment resolution.',
  [PlanFeatureTypes.FEATURE_CUSTOM_URL]: 'to use a custom URL.',
  [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: 'to use discussion mode.',
  [PlanFeatureTypes.FEATURE_EXTENSIONS]: 'to enable extensions.',
  [PlanFeatureTypes.FEATURE_FILE_MODE]: 'to enable file mode.',
  [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]:
    'to access redirect after form submission feature',
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: 'to add a custom logo to forms.',
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]:
    'to access conditional form fields feature',
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]:
    'to access form field validation feature',
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]:
    'to use group-by aggregations.',
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: 'to remove branding.',
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]:
    'to limit row selection by filters.',
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: 'to use personal views.',
  [PlanFeatureTypes.FEATURE_SCRIPTS]: 'to enable scripts.',
  [PlanFeatureTypes.FEATURE_SSO]: 'to enable SSO (Single Sign-On).',
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]:
    'to send custom webhook payloads.',
  [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]:
    'to upload a custom image as workspace avatar',
  [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]:
    'to filter view by current user',
  [PlanFeatureTypes.FEATURE_WEBHOOK_SCHEDULED]: 'to use scheduled webhooks.',
};

export const getUpgradeMessage = (
  limitOrFeature?: PlanLimitTypes | PlanFeatureTypes | string
) => {
  if (!limitOrFeature) return '';

  if (PlanLimitUpgradeMessages[limitOrFeature]) {
    return PlanLimitUpgradeMessages[limitOrFeature];
  }

  if (PlanFeatureUpgradeMessages[limitOrFeature]) {
    return PlanFeatureUpgradeMessages[limitOrFeature];
  }

  return limitOrFeature;
};
