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
}

export enum PlanTitles {
  FREE = 'Free',
  TEAM = 'Team',
  BUSINESS = 'Business',
  ENTERPRISE = 'Enterprise',
}

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
};
