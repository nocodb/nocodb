import {
  PlanFeatureTypes,
  PlanLimitTypes,
  PlanOrder,
  PlanTitles,
} from 'src/lib/payment';

export * from 'src/lib/payment';

// ---------------------------------------------------------------------------
// Plan definitions — single source of truth for cloud plan gating
// ---------------------------------------------------------------------------
// PlanFeatureDefinitions: features that UNLOCK at each tier
// PlanLimitDefinitions:   numeric limits per tier
//
// To add a new paid feature:
//   1. Add enum to PlanFeatureTypes (in src/lib/payment)
//   2. Add it to the appropriate tier below
//   3. Deploy — no Stripe sync needed
//
// Features NOT listed default to enabled for all plans.
// ---------------------------------------------------------------------------

export const PlanFeatureDefinitions: Record<PlanTitles, PlanFeatureTypes[]> = {
  [PlanTitles.FREE]: [
    PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD,
    PlanFeatureTypes.FEATURE_DISCUSSION_MODE,
    PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS,
    PlanFeatureTypes.FEATURE_AI_CHAT,
    PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION,
  ],

  [PlanTitles.PLUS]: [
    PlanFeatureTypes.FEATURE_AI,
    PlanFeatureTypes.FEATURE_AT_MENTION,
    PlanFeatureTypes.FEATURE_COMMENT_RESOLVE,
    PlanFeatureTypes.FEATURE_EXTENSIONS,
    PlanFeatureTypes.FEATURE_FILE_MODE,
    PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION,
    PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO,
    PlanFeatureTypes.FEATURE_FORM_CUSTOM_SUBMIT_LABEL,
    PlanFeatureTypes.FEATURE_FORM_SCHEDULING,
    PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
    PlanFeatureTypes.FEATURE_HIDE_BRANDING,
    PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER,
    PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER,
    PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER,
    PlanFeatureTypes.FEATURE_PERSONAL_VIEWS,
    PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO,
    PlanFeatureTypes.FEATURE_ROW_COLOUR,
    PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
    PlanFeatureTypes.FEATURE_CALENDAR_RANGE,
    PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD,
    PlanFeatureTypes.FEATURE_AI_BUTTON_FIELD,
    PlanFeatureTypes.FEATURE_DOC_AI,
    PlanFeatureTypes.FEATURE_COLOUR_FIELD,
    PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE,
    PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS,
    PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER,
    PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY,
    PlanFeatureTypes.FEATURE_TOGGLE_FILTER,
    PlanFeatureTypes.FEATURE_PINNED_FILTER,
    PlanFeatureTypes.FEATURE_UUID_FIELD,
    PlanFeatureTypes.FEATURE_AUTONUMBER_FIELD,
    PlanFeatureTypes.FEATURE_RECORD_TEMPLATES,
    PlanFeatureTypes.FEATURE_CUSTOM_URL,
    PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS,
    PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF,
  ],

  [PlanTitles.BUSINESS]: [
    PlanFeatureTypes.FEATURE_DOCS_APIS,
    PlanFeatureTypes.FEATURE_AI_INTEGRATIONS,
    PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY,
    PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER,
    PlanFeatureTypes.FEATURE_CELL_COLOUR,
    PlanFeatureTypes.FEATURE_PRIVATE_BASES,
    PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT,
    PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
    PlanFeatureTypes.FEATURE_SSO,
    PlanFeatureTypes.FEATURE_SYNC,
    PlanFeatureTypes.FEATURE_UNIQUE,
    PlanFeatureTypes.FEATURE_VIEW_SECTIONS,
    PlanFeatureTypes.FEATURE_LIST_VIEW,
    PlanFeatureTypes.FEATURE_MAP_VIEW,
    PlanFeatureTypes.FEATURE_TIMELINE_VIEW,
    PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS,
    PlanFeatureTypes.FEATURE_DATE_DEPENDENCY,
    PlanFeatureTypes.FEATURE_API_WEBHOOK_V3,
    PlanFeatureTypes.FEATURE_API_COMMENT_V3,
  ],

  [PlanTitles.ENTERPRISE]: [
    PlanFeatureTypes.FEATURE_RLS,
    PlanFeatureTypes.FEATURE_TEAM_HIERARCHY,
    PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
    PlanFeatureTypes.FEATURE_SCIM,
    PlanFeatureTypes.FEATURE_API_VIEW_V3,
    PlanFeatureTypes.FEATURE_API_DASHBOARD_V3,
    PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT,
  ],
};

// Auto-generated: Feature → minimum plan (used by upgrade badges and resolvePlanMeta)
export const PlanFeatureTypesToPlanTitles = Object.entries(
  PlanFeatureDefinitions
).reduce((acc, [plan, features]) => {
  for (const feature of features) {
    acc[feature] = plan as PlanTitles;
  }
  return acc;
}, {} as Record<PlanFeatureTypes, PlanTitles>);

// ---------------------------------------------------------------------------
// Per-plan limit definitions
// ---------------------------------------------------------------------------

export const PlanLimitDefinitions: Record<
  PlanTitles,
  Partial<Record<PlanLimitTypes, number>>
> = {
  [PlanTitles.FREE]: {
    // Cloud Free is defined in ee-cloud/models/Plan.ts (inverted defaults).
    // This entry is only used by the EE dev/CI fallback (everything unlimited).
  },

  [PlanTitles.PLUS]: {
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
    [PlanLimitTypes.LIMIT_API_CALL]: 100000,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
    [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 1000,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 60,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 7,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 10000,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 50000,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 2,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 20000,
    [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 60,
    [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 75000,
  },

  [PlanTitles.BUSINESS]: {
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
    [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 1000,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 180,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 90,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 50000,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 300000,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 100000,
    [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 5,
    [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 180,
    [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 150000,
  },

  [PlanTitles.ENTERPRISE]: {
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
    [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 1000,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 365,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 365,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000000,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 25,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 500000,
    [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 365,
    [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 750000,
  },
};

// ---------------------------------------------------------------------------
// resolvePlanMeta — computes the full feature/limit meta for a plan
// ---------------------------------------------------------------------------

export function resolvePlanMeta(
  title: PlanTitles | string
): Record<string, number | boolean> {
  const meta: Record<string, number | boolean> = {};

  // Default: all limits unlimited, all features enabled
  for (const limit of Object.values(PlanLimitTypes)) {
    meta[limit] = -1;
  }
  for (const feature of Object.values(PlanFeatureTypes)) {
    meta[feature] = true;
  }

  // Free plan meta is defined separately (ee-cloud for cloud, ee for dev/CI)
  if (title === PlanTitles.FREE) {
    return meta;
  }

  // Derive feature restrictions from the feature-to-plan map
  const planOrder = PlanOrder[title as PlanTitles] ?? 0;
  for (const [feature, minPlan] of Object.entries(
    PlanFeatureTypesToPlanTitles
  )) {
    if (planOrder < (PlanOrder[minPlan] ?? 0)) {
      meta[feature] = false;
    }
  }

  // Apply plan-specific limits
  const limits = PlanLimitDefinitions[title as PlanTitles];
  if (limits) {
    Object.assign(meta, limits);
  }

  return meta;
}
