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
  LIMIT_WORKFLOW_RUN = 'limit_workflow_run',
  LIMIT_WORKFLOW_RETENTION = 'limit_workflow_retention',
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
  LIMIT_ATTACHMENTS_IN_CELL = 'limit_attachments_in_cell',
  LIMIT_SCRIPT_PER_WORKSPACE = 'limit_script',
  LIMIT_DASHBOARD_PER_WORKSPACE = 'limit_dashboard',
  LIMIT_TEAM_MANAGEMENT = 'limit_team_management',
  LIMIT_SANDBOX_PER_BASE = 'limit_sandbox',
  LIMIT_RLS_POLICIES_PER_TABLE = 'limit_rls_policies_per_table',
  LIMIT_DOCUMENT_PAGE_PER_BASE = 'limit_document_page_per_base',
  LIMIT_DOCS_PAGE_SIZE_KB = 'limit_docs_page_size_kb',
  LIMIT_WORKSPACE = 'limit_workspace',
  LIMIT_TRASH_RETENTION = 'limit_trash_retention',
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
  FEATURE_FORM_CUSTOM_SUBMIT_LABEL = 'feature_form_custom_submit_label',
  FEATURE_FORM_SCHEDULING = 'feature_form_scheduling',
  FEATURE_FORM_FIELD_ON_CONDITION = 'feature_form_field_on_condition',
  FEATURE_FORM_FIELD_VALIDATION = 'feature_form_field_validation',
  FEATURE_GROUP_BY_AGGREGATIONS = 'feature_group_by_aggregations',
  FEATURE_HIDE_BRANDING = 'feature_hide_branding',
  FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER = 'feature_ltar_limit_selection_by_filter',
  FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER = 'feature_lookup_limit_records_by_filter',
  FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER = 'feature_rollup_limit_records_by_filter',
  FEATURE_PERSONAL_VIEWS = 'feature_personal_views',
  FEATURE_SSO = 'feature_sso',
  FEATURE_WEBHOOK_CUSTOM_PAYLOAD = 'feature_webhook_custom_payload',
  FEATURE_WORKSPACE_CUSTOM_LOGO = 'feature_workspace_custom_logo',
  FEATURE_CURRENT_USER_FILTER = 'feature_current_user_filter',
  FEATURE_ROW_COLOUR = 'feature_row_colour',
  FEATURE_CELL_COLOUR = 'feature_cell_colour',
  FEATURE_TABLE_AND_FIELD_PERMISSIONS = 'feature_table_and_field_permissions',
  FEATURE_PRIVATE_BASES = 'feature_private_bases',
  FEATURE_API_MEMBER_MANAGEMENT = 'feature_api_member_management',
  FEATURE_TEAM_MANAGEMENT = 'feature_team_management',
  FEATURE_API_SCRIPT_MANAGEMENT = 'feature_api_script_management',
  FEATURE_API_DASHBOARD_V3 = 'feature_api_dashboard_v3',
  FEATURE_API_VIEW_V3 = 'feature_api_view_v3',
  FEATURE_API_WEBHOOK_V3 = 'feature_api_webhook_v3',
  FEATURE_CALENDAR_RANGE = 'feature_calendar_range',
  FEATURE_AI_PROMPT_FIELD = 'feature_ai_prompt_field',
  FEATURE_AI_BUTTON_FIELD = 'feature_ai_button_field',
  FEATURE_BUTTON_VISIBILITY = 'feature_button_visibility',
  FEATURE_COLOUR_FIELD = 'feature_colour_field',
  FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE = 'feature_duplicate_table_to_other_base',
  FEATURE_DUPLICATE_TABLE_TO_OTHER_WS = 'feature_duplicate_table_to_other_ws',
  FEATURE_COPY_VIEW_SETTING_FROM_OTHER = 'feature_copy_view_setting_other',
  FEATURE_CARD_FIELD_HEADER_VISIBILITY = 'feature_card_field_header_visibility',
  FEATURE_SCIM = 'feature_scim',
  FEATURE_SYNC = 'feature_sync',
  FEATURE_UNIQUE = 'feature_unique',
  FEATURE_TOGGLE_FILTER = 'feature_toggle_filter',
  FEATURE_PINNED_FILTER = 'feature_pinned_filter',
  FEATURE_UUID_FIELD = 'feature_uuid_field',
  FEATURE_AUTONUMBER_FIELD = 'feature_autonumber_field',
  FEATURE_RECORD_TEMPLATES = 'feature_record_templates',
  FEATURE_RLS = 'feature_rls',
  FEATURE_VIEW_SECTIONS = 'feature_view_sections',
  FEATURE_MAP_VIEW = 'feature_map_view',
  FEATURE_LIST_VIEW = 'feature_list_view',
  FEATURE_TEAM_HIERARCHY = 'feature_team_hierarchy',
  FEATURE_MFA = 'feature_mfa',
  FEATURE_FORCE_2FA = 'feature_force_2fa',
  FEATURE_TIMELINE_VIEW = 'feature_timeline_view',
  FEATURE_AI_CHAT = 'feature_ai_chat',
  /** Core Documents feature (create/view/edit). Do not conflate with FEATURE_DOCS_APIS (V3 API access only). */
  FEATURE_DOCS = 'feature_docs',
  FEATURE_DOCS_APIS = 'feature_docs_apis',
  FEATURE_DOCS_INLINE_COMMENTS = 'feature_docs_inline_comments',
  FEATURE_DOCS_EXPORT_PDF = 'feature_docs_export_pdf',
  FEATURE_DOCUMENT_PERMISSIONS = 'feature_document_permissions',
  FEATURE_DOC_AI = 'feature_doc_ai',
  FEATURE_DATE_DEPENDENCY = 'feature_date_dependency',
  FEATURE_API_COMMENT_V3 = 'feature_api_comment_v3',
  FEATURE_API_WORKFLOW_MANAGEMENT = 'feature_api_workflow_management',
  /** On-prem: core EE capability flag — true for all paid plans, false for free */
  FEATURE_EE_CORE = 'feature_ee_core',
  FEATURE_TRASH_SETTINGS = 'feature_trash_settings',
}

export enum PlanTitles {
  FREE = 'Free',
  PLUS = 'Plus',
  BUSINESS = 'Business',
  ENTERPRISE = 'Enterprise',
}

export enum OnPremPlanTitles {
  FREE = 'Free',
  SELF_HOSTED_STARTER = 'Self-hosted Starter',
  SELF_HOSTED_SCALE = 'Self-hosted Scale',
  SELF_HOSTED_ENTERPRISE = 'Self-hosted Enterprise',
}

export enum PlanPriceLookupKeys {
  PLUS_MONTHLY = 'plus_monthly',
  PLUS_YEARLY = 'plus_yearly',
  BUSINESS_MONTHLY = 'business_monthly',
  BUSINESS_YEARLY = 'business_yearly',
}

export const LoyaltyPriceLookupKeyMap = {
  [PlanPriceLookupKeys.PLUS_MONTHLY]: 'loyalty_plus_monthly',
  [PlanPriceLookupKeys.PLUS_YEARLY]: 'loyalty_plus_yearly',
  [PlanPriceLookupKeys.BUSINESS_MONTHLY]: 'loyalty_business_monthly',
  [PlanPriceLookupKeys.BUSINESS_YEARLY]: 'loyalty_business_yearly',
};

export const LoyaltyPriceReverseLookupKeyMap = {
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.PLUS_MONTHLY]]:
    PlanPriceLookupKeys.PLUS_MONTHLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.PLUS_YEARLY]]:
    PlanPriceLookupKeys.PLUS_YEARLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.BUSINESS_MONTHLY]]:
    PlanPriceLookupKeys.BUSINESS_MONTHLY,
  [LoyaltyPriceLookupKeyMap[PlanPriceLookupKeys.BUSINESS_YEARLY]]:
    PlanPriceLookupKeys.BUSINESS_YEARLY,
};

export const PlanMeta = {
  [PlanTitles.FREE]: {
    title: PlanTitles.FREE,
    color: 'var(--free-plan-color, #F9F9FA)',
    accent: 'var(--free-plan-accent, #E7E7E9)',
    primary: 'var(--free-plan-primary, #1F293A)',
    bgLight: 'var(--free-plan-bg-light, #F9F9FA)',
    bgDark: 'var(--free-plan-bg-dark, #F4F4F5)',
    border: 'var(--free-plan-border, #E7E7E9)',
    chartFillColor: 'var(--color-gray-500, #6A7184)',
    badgeBgColor: 'var(--free-plan-badge-bg-color, #F4F4F5)',
    badgeTextColor: 'var(--free-plan-badge-text-color, #1F293A)',
    // Static (theme-independent) badge colors — used by upgrade pills that
    // must read identically in light + dark. No CSS var, no dark-mode flip.
    staticBadgeBgColor: '#F4F4F5',
    staticBadgeTextColor: '#1F293A',
  },
  [PlanTitles.PLUS]: {
    title: PlanTitles.PLUS,
    color: 'var(--plus-plan-color, #EDF9FF)',
    accent: 'var(--plus-plan-accent, #AFE5FF)',
    primary: 'var(--plus-plan-primary, #207399)',
    bgLight: 'var(--plus-plan-bg-light, #EDF9FF)',
    bgDark: 'var(--plus-plan-bg-dark, #D7F2FF)',
    border: 'var(--plus-plan-border, #AFE5FF)',
    chartFillColor: 'var(--plus-plan-chart-fill-color, #207399)',
    badgeBgColor: 'var(--plus-plan-badge-bg-color, #D7F2FF)',
    badgeTextColor: 'var(--plus-plan-badge-text-color, #207399)',
    staticBadgeBgColor: '#D7F2FF',
    staticBadgeTextColor: '#207399',
  },
  [PlanTitles.BUSINESS]: {
    title: PlanTitles.BUSINESS,
    color: 'var(--business-plan-color, #FAF5FF)',
    accent: 'var(--business-plan-accent, #FEB0E8)',
    primary: 'var(--business-plan-primary, #972377)',
    bgLight: 'var(--business-plan-bg-light, #FFEEFB)',
    bgDark: 'var(--business-plan-bg-dark, #FED8F4)',
    border: 'var(--business-plan-border, #FEB0E8)',
    chartFillColor: 'var(--business-plan-chart-fill-color, #972377)',
    badgeBgColor: 'var(--business-plan-badge-bg-color, #FFF0FB)',
    badgeTextColor: 'var(--business-plan-badge-text-color, #C44DA0)',
    staticBadgeBgColor: '#FFF0FB',
    staticBadgeTextColor: '#C44DA0',
  },
  [PlanTitles.ENTERPRISE]: {
    title: PlanTitles.ENTERPRISE,
    color: 'var(--enterprise-plan-color, #EAF7F7)',
    accent: 'var(--enterprise-plan-accent, #8FC8C8)',
    primary: 'var(--enterprise-plan-primary, #0D5A5A)',
    bgLight: 'var(--enterprise-plan-bg-light, #EAF7F7)',
    bgDark: 'var(--enterprise-plan-bg-dark, #CFEAEA)',
    border: 'var(--enterprise-plan-border, #8FC8C8)',
    chartFillColor: 'var(--enterprise-plan-chart-fill-color, #0D5A5A)',
    badgeBgColor: 'var(--enterprise-plan-badge-bg-color, #CFEAEA)',
    badgeTextColor: 'var(--enterprise-plan-badge-text-color, #0D5A5A)',
    staticBadgeBgColor: '#CFEAEA',
    staticBadgeTextColor: '#0D5A5A',
  },
} as const;

export const PlanOrder = {
  [PlanTitles.FREE]: 0,
  [PlanTitles.PLUS]: 1,
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
  [PlanTitles.FREE]: PlanTitles.PLUS,
  [PlanTitles.PLUS]: PlanTitles.BUSINESS,
  [PlanTitles.BUSINESS]: PlanTitles.ENTERPRISE,
} as Record<string, PlanTitles>;

export const GRACE_PERIOD_DURATION = 14;

export const LOYALTY_GRACE_PERIOD_END_DATE = '2025-09-03';

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
  [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]:
    'to add more attachments in a cell.',
  [PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE]:
    'to add more scripts in a workspace.',
  [PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE]:
    'to add more dashboards in a workspace.',
  [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 'to add more teams in a workspace.',
  [PlanLimitTypes.LIMIT_RLS_POLICIES_PER_TABLE]:
    'to add more row-level security policies per table.',
  [PlanLimitTypes.LIMIT_WORKSPACE]: 'to create more workspaces.',
  [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 'to run more workflows.',
  [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]:
    'to increase workflow logs retention.',
  [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 'to add more sandboxes.',
  [PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE]:
    'to add more document pages in a base.',
  [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]:
    'to increase the document page size limit.',
  [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 'for extended trash retention.',
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
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_SUBMIT_LABEL]:
    'to customize the submit button label.',
  [PlanFeatureTypes.FEATURE_FORM_SCHEDULING]: 'to schedule form availability.',
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]:
    'to access conditional form fields feature',
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]:
    'to access form field validation feature',
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]:
    'to use group-by aggregations.',
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: 'to remove branding.',
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]:
    'to limit row selection by filters.',
  [PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER]:
    'to limit lookup records by filters.',
  [PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER]:
    'to limit rollup records by filters.',
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: 'to use personal views.',
  [PlanFeatureTypes.FEATURE_SSO]: 'to enable SSO (Single Sign-On).',
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]:
    'to send custom webhook payloads.',
  [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]:
    'to upload a custom image as workspace avatar',
  [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]:
    'to filter view by current user',
  [PlanFeatureTypes.FEATURE_ROW_COLOUR]: 'to use row colouring.',
  [PlanFeatureTypes.FEATURE_CELL_COLOUR]: 'to use cell colouring.',
  [PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS]:
    'to use table and field permissions.',
  [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: 'to use private bases.',
  [PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT]:
    'to use member management api.',
  [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: 'to use team management.',
  [PlanFeatureTypes.FEATURE_API_VIEW_V3]: 'to use view api.',
  [PlanFeatureTypes.FEATURE_API_WEBHOOK_V3]: 'to use webhook api.',
  [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: 'to use script api.',
  [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: 'to use dashboard api.',
  [PlanFeatureTypes.FEATURE_CALENDAR_RANGE]:
    'to visualize records in a calendar range.',
  [PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD]: 'to use AI text fields.',
  [PlanFeatureTypes.FEATURE_AI_BUTTON_FIELD]: 'to use AI button fields.',
  [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]:
    'to use button visibility conditions.',
  [PlanFeatureTypes.FEATURE_COLOUR_FIELD]: 'to use colour fields.',
  [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE]:
    'to target different base when duplicate table.',
  [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS]:
    'to target different workspace when duplicate table.',
  [PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER]:
    'to copy view configuration from another view.',
  [PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY]:
    'to hide field headers in Gallery and Kanban views.',
  [PlanFeatureTypes.FEATURE_SCIM]: 'to enable SCIM provisioning.',
  [PlanFeatureTypes.FEATURE_SYNC]: 'to use sync feature.',
  [PlanFeatureTypes.FEATURE_UNIQUE]: 'to use unique constraint.',
  [PlanFeatureTypes.FEATURE_TOGGLE_FILTER]:
    'to enable or disable individual filters.',
  [PlanFeatureTypes.FEATURE_PINNED_FILTER]: 'to pin filters to the toolbar.',
  [PlanFeatureTypes.FEATURE_UUID_FIELD]: 'to use UUID fields.',
  [PlanFeatureTypes.FEATURE_AUTONUMBER_FIELD]: 'to use AutoNumber fields.',
  [PlanFeatureTypes.FEATURE_RECORD_TEMPLATES]: 'to use record templates.',
  [PlanFeatureTypes.FEATURE_RLS]: 'to use row-level security.',
  [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: 'to organize views into sections.',
  [PlanFeatureTypes.FEATURE_MAP_VIEW]: 'to use map view.',
  [PlanFeatureTypes.FEATURE_LIST_VIEW]: 'to use list view.',
  [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: 'to use team hierarchy.',
  [PlanFeatureTypes.FEATURE_MFA]: 'to enable multi-factor authentication.',
  [PlanFeatureTypes.FEATURE_FORCE_2FA]:
    'to require two-factor authentication for all workspace members.',
  [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: 'to use timeline view.',
  [PlanFeatureTypes.FEATURE_AI_CHAT]: 'to use AI chat.',
  [PlanFeatureTypes.FEATURE_DOCS]: 'to use Documents.',
  [PlanFeatureTypes.FEATURE_DOCS_APIS]: 'to access Documents API.',
  [PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS]:
    'to use inline comments in documents.',
  [PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF]: 'to export documents as PDF.',
  [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]:
    'to use document permissions.',
  [PlanFeatureTypes.FEATURE_DOC_AI]: 'to use AI features in documents.',
  [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: 'to use date dependencies.',
  [PlanFeatureTypes.FEATURE_API_COMMENT_V3]: 'to use comment api.',
  [PlanFeatureTypes.FEATURE_API_WORKFLOW_MANAGEMENT]: 'to use workflow api.',
  [PlanFeatureTypes.FEATURE_EE_CORE]: 'to access enterprise features.',
  [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]:
    'to configure per-table trash settings.',
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

export enum ReturnToBillingPage {
  ORG = 'org',
  ACCOUNT = 'account',
  WS = 'ws',
  SELF_HOSTED = 'self_hosted',
}

export const PlanFeatureTypesToPlanTitles = {} as Record<
  PlanFeatureTypes,
  PlanTitles
>;

export type PlanMetaType = Partial<
  Record<PlanFeatureTypes, boolean> & Record<PlanLimitTypes, number>
>;
