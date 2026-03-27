import {
  OnPremPlanTitles,
  PlanFeatureTypes,
  PlanLimitTypes,
  PlanOrder,
  PlanTitles,
} from 'src/lib/payment';

export * from 'src/lib/payment';

// ---------------------------------------------------------------------------
// Cloud plan definitions — single source of truth for cloud plan gating
// ---------------------------------------------------------------------------
// Override model: base = all features enabled (true), all limits unlimited (-1).
// Each plan lists OVERRIDES — disabled features (false) and restricted limits.
//
// FREE:       5 features stay enabled; all 62 others are explicitly disabled.
//             All 33 limits are set here (single source of truth for cloud Free).
// PLUS:       Business+ and Enterprise-only features disabled (27 total).
// BUSINESS:   Enterprise-only features disabled (7 total).
// ENTERPRISE: Nothing disabled — all features available.
//
// To add a new paid feature:
//   1. Add enum to PlanFeatureTypes (in src/lib/payment)
//   2. Add as `false` to every plan below its unlock tier:
//      - Plus+:       add to FREE.features
//      - Business+:   add to FREE.features and PLUS.features
//      - Enterprise+: add to FREE.features, PLUS.features, and BUSINESS.features
//   3. Deploy — no Stripe sync needed
// ---------------------------------------------------------------------------

export const CloudPlanDefinitions: Record<
  PlanTitles,
  {
    features: Partial<Record<PlanFeatureTypes, boolean>>;
    limits: Partial<Record<PlanLimitTypes, number>>;
  }
> = {
  // -------------------------------------------------------------------------
  // FREE — 5 features enabled, 62 disabled; all limits explicit
  // Enabled: WEBHOOK_CUSTOM_PAYLOAD, DISCUSSION_MODE, GROUP_BY_AGGREGATIONS,
  //          AI_CHAT, FORM_FIELD_ON_CONDITION
  // -------------------------------------------------------------------------
  [PlanTitles.FREE]: {
    features: {
      // Plus+ features (disabled at Free)
      [PlanFeatureTypes.FEATURE_AI]: false,
      [PlanFeatureTypes.FEATURE_AT_MENTION]: false,
      [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: false,
      [PlanFeatureTypes.FEATURE_CUSTOM_URL]: false,
      [PlanFeatureTypes.FEATURE_EXTENSIONS]: false,
      [PlanFeatureTypes.FEATURE_FILE_MODE]: false,
      [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: false,
      [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: false,
      [PlanFeatureTypes.FEATURE_FORM_CUSTOM_SUBMIT_LABEL]: false,
      [PlanFeatureTypes.FEATURE_FORM_SCHEDULING]: false,
      [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: false,
      [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: false,
      [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: false,
      [PlanFeatureTypes.FEATURE_LOOKUP_LIMIT_RECORDS_BY_FILTER]: false,
      [PlanFeatureTypes.FEATURE_ROLLUP_LIMIT_RECORDS_BY_FILTER]: false,
      [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: false,
      [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: false,
      [PlanFeatureTypes.FEATURE_ROW_COLOUR]: false,
      [PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_CALENDAR_RANGE]: false,
      [PlanFeatureTypes.FEATURE_AI_PROMPT_FIELD]: false,
      [PlanFeatureTypes.FEATURE_AI_BUTTON_FIELD]: false,
      [PlanFeatureTypes.FEATURE_DOC_AI]: false,
      [PlanFeatureTypes.FEATURE_COLOUR_FIELD]: false,
      [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_BASE]: false,
      [PlanFeatureTypes.FEATURE_DUPLICATE_TABLE_TO_OTHER_WS]: false,
      [PlanFeatureTypes.FEATURE_COPY_VIEW_SETTING_FROM_OTHER]: false,
      [PlanFeatureTypes.FEATURE_CARD_FIELD_HEADER_VISIBILITY]: false,
      [PlanFeatureTypes.FEATURE_TOGGLE_FILTER]: false,
      [PlanFeatureTypes.FEATURE_PINNED_FILTER]: false,
      [PlanFeatureTypes.FEATURE_UUID_FIELD]: false,
      [PlanFeatureTypes.FEATURE_AUTONUMBER_FIELD]: false,
      [PlanFeatureTypes.FEATURE_RECORD_TEMPLATES]: false,
      [PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS]: false,
      [PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF]: false,
      // Business+ features (disabled at Free)
      [PlanFeatureTypes.FEATURE_DOCS_APIS]: false,
      [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: false,
      [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]: false,
      [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]: false,
      [PlanFeatureTypes.FEATURE_CELL_COLOUR]: false,
      [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
      [PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_SSO]: false,
      [PlanFeatureTypes.FEATURE_SYNC]: false,
      [PlanFeatureTypes.FEATURE_UNIQUE]: false,
      [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
      [PlanFeatureTypes.FEATURE_LIST_VIEW]: false,
      [PlanFeatureTypes.FEATURE_MAP_VIEW]: false,
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_API_WEBHOOK_V3]: false,
      [PlanFeatureTypes.FEATURE_API_COMMENT_V3]: false,
      [PlanFeatureTypes.FEATURE_API_WORKFLOW_MANAGEMENT]: false,
      // Enterprise-only features (disabled at Free)
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_API_VIEW_V3]: false,
      [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: false,
      [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: false,
    },
    limits: {
      // Seat limits
      [PlanLimitTypes.LIMIT_EDITOR]: 3,
      [PlanLimitTypes.LIMIT_COMMENTER]: 10,
      // API & rate limits
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
      [PlanLimitTypes.LIMIT_API_CALL]: 1000,
      // AI
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 0,
      // Data limits
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 1000,
      [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 10,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
      // Structure limits (consistent across all plans)
      [PlanLimitTypes.LIMIT_FREE_WORKSPACE]: 8,
      [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: 500,
      [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 200,
      [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: 500,
      [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: 25,
      [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: 200,
      [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: 50,
      [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: 10,
      [PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE]: 3,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 256,
      // Automation & workflow
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 0,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 1000,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 15,
      // Audit
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 14,
      // Extensions & tools
      [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: 50,
      [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 0,
      [PlanLimitTypes.LIMIT_SCRIPT_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 0,
      // Team & RLS (not available on Free)
      [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 0,
      [PlanLimitTypes.LIMIT_RLS_POLICIES_PER_TABLE]: 0,
      // Workspaces (cloud Free = single workspace)
      [PlanLimitTypes.LIMIT_WORKSPACE]: 0,
    },
  },

  // -------------------------------------------------------------------------
  // PLUS — Business+ and Enterprise-only features disabled (27 total)
  // -------------------------------------------------------------------------
  [PlanTitles.PLUS]: {
    features: {
      // Business+ features (disabled at Plus)
      [PlanFeatureTypes.FEATURE_DOCS_APIS]: false,
      [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: false,
      [PlanFeatureTypes.FEATURE_BUTTON_VISIBILITY]: false,
      [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]: false,
      [PlanFeatureTypes.FEATURE_CELL_COLOUR]: false,
      [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
      [PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_SSO]: false,
      [PlanFeatureTypes.FEATURE_SYNC]: false,
      [PlanFeatureTypes.FEATURE_UNIQUE]: false,
      [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
      [PlanFeatureTypes.FEATURE_LIST_VIEW]: false,
      [PlanFeatureTypes.FEATURE_MAP_VIEW]: false,
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_API_WEBHOOK_V3]: false,
      [PlanFeatureTypes.FEATURE_API_COMMENT_V3]: false,
      [PlanFeatureTypes.FEATURE_API_WORKFLOW_MANAGEMENT]: false,
      // Enterprise-only features (disabled at Plus)
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_API_VIEW_V3]: false,
      [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: false,
      [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: false,
    },
    limits: {
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
      [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 500,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 60,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 75000,
    },
  },

  // -------------------------------------------------------------------------
  // BUSINESS — Enterprise-only features disabled (7 total)
  // -------------------------------------------------------------------------
  [PlanTitles.BUSINESS]: {
    features: {
      // Enterprise-only features (disabled at Business)
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_API_VIEW_V3]: false,
      [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: false,
      [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: false,
    },
    limits: {
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
      [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 500,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 150000,
    },
  },

  // -------------------------------------------------------------------------
  // ENTERPRISE — no features disabled; all unlimited or set high
  // -------------------------------------------------------------------------
  [PlanTitles.ENTERPRISE]: {
    features: {},
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
      [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 1000,
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000000,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 25,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 500000,
      [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 500,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 750000,
    },
  },
};

// Auto-generated: Feature → minimum plan that enables it.
// Scans plans from lowest to highest; returns the first where the feature is NOT disabled.
export const PlanFeatureTypesToPlanTitles = (() => {
  const result = {} as Record<PlanFeatureTypes, PlanTitles>;
  const sortedPlans = (Object.keys(PlanOrder) as PlanTitles[]).sort(
    (a, b) => PlanOrder[a] - PlanOrder[b]
  );
  for (const feature of Object.values(PlanFeatureTypes)) {
    for (const plan of sortedPlans) {
      if (CloudPlanDefinitions[plan]?.features[feature] !== false) {
        result[feature] = plan;
        break;
      }
    }
  }
  return result;
})();

// ---------------------------------------------------------------------------
// resolvePlanMeta — computes the full feature/limit meta for a plan
// ---------------------------------------------------------------------------
// Override model: start with base (all features true, all limits -1),
// then apply the plan's feature/limit overrides from CloudPlanDefinitions.
// ---------------------------------------------------------------------------

export function resolvePlanMeta(
  title: PlanTitles | string
): Record<string, number | boolean> {
  const meta: Record<string, number | boolean> = {};

  // Base: all limits unlimited, all features enabled
  for (const limit of Object.values(PlanLimitTypes)) {
    meta[limit] = -1;
  }
  for (const feature of Object.values(PlanFeatureTypes)) {
    meta[feature] = true;
  }

  // Apply plan overrides (disabled features + restricted limits)
  const def = CloudPlanDefinitions[title as PlanTitles];
  if (def) {
    Object.assign(meta, def.features);
    Object.assign(meta, def.limits);
  }

  return meta;
}

// ---------------------------------------------------------------------------
// On-prem plan pricing lookup keys
// ---------------------------------------------------------------------------

export enum OnPremPlanPriceLookupKeys {
  STARTER_MONTHLY = 'on_prem_starter_monthly',
  STARTER_YEARLY = 'on_prem_starter_yearly',
  SCALE_MONTHLY = 'on_prem_scale_monthly',
  SCALE_YEARLY = 'on_prem_scale_yearly',
}

// ---------------------------------------------------------------------------
// On-prem plan metadata, ordering, and upgrade paths
// ---------------------------------------------------------------------------

export const OnPremPlanMeta = {
  // Starter = blue (first tier), Scale = pink (second tier), Enterprise = orange (third tier)
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: {
    title: OnPremPlanTitles.SELF_HOSTED_STARTER,
    color: 'var(--plus-plan-color, #EDF9FF)',
    accent: 'var(--plus-plan-accent, #AFE5FF)',
    primary: 'var(--plus-plan-primary, #207399)',
    bgLight: 'var(--plus-plan-bg-light, #EDF9FF)',
    bgDark: 'var(--plus-plan-bg-dark, #D7F2FF)',
    border: 'var(--plus-plan-border, #AFE5FF)',
    badgeBgColor: 'var(--plus-plan-badge-bg-color, #D7F2FF)',
    badgeTextColor: 'var(--plus-plan-badge-text-color, #207399)',
  },
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
    title: OnPremPlanTitles.SELF_HOSTED_SCALE,
    color: 'var(--business-plan-color, #FAF5FF)',
    accent: 'var(--business-plan-accent, #FEB0E8)',
    primary: 'var(--business-plan-primary, #972377)',
    bgLight: 'var(--business-plan-bg-light, #FFEEFB)',
    bgDark: 'var(--business-plan-bg-dark, #FED8F4)',
    border: 'var(--business-plan-border, #FEB0E8)',
    badgeBgColor: 'var(--business-plan-badge-bg-color, #FED8F4)',
    badgeTextColor: 'var(--business-plan-badge-text-color, #972377)',
  },
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: {
    title: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
    color: 'var(--enterprise-plan-color, #FFF5EF)',
    accent: 'var(--enterprise-plan-accent, #663B1F)',
    primary: 'var(--enterprise-plan-primary, #C86827)',
    bgLight: 'var(--enterprise-plan-bg-light, #FFF5EF)',
    bgDark: 'var(--enterprise-plan-bg-dark, #FEE6D6)',
    border: 'var(--enterprise-plan-border, #FDCDAD)',
    badgeBgColor: 'var(--enterprise-plan-badge-bg-color, #FEE6D6)',
    badgeTextColor: 'var(--enterprise-plan-badge-text-color, #C86827)',
  },
} as const;

export const OnPremPlanOrder = {
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: 0,
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: 1,
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: 2,
};

export const OnPremHigherPlan = {
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: OnPremPlanTitles.SELF_HOSTED_SCALE,
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
} as Record<string, OnPremPlanTitles>;

// ---------------------------------------------------------------------------
// On-prem plan definitions — single source of truth for on-prem feature gating
// ---------------------------------------------------------------------------
// Base assumption: all features enabled, all limits unlimited (-1).
// Each plan only lists OVERRIDES — disabled features and restricted limits.
// ---------------------------------------------------------------------------

export const OnPremPlanDefinitions: Record<
  string,
  {
    features: Partial<Record<PlanFeatureTypes, boolean>>;
    limits: Partial<Record<PlanLimitTypes, number>>;
  }
> = {
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: {
    features: {
      // Scale+ only
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SSO]: false,
      [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
      // Enterprise only
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 180, // days
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 90, // days
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 180, // days
    },
  },
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
    features: {
      // Enterprise only
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 365, // days
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 180, // days
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 365, // days
    },
  },
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: {
    features: {},
    limits: {},
  },
};

/**
 * On-prem: feature → lowest plan that enables it.
 * Derived from OnPremPlanDefinitions — a feature is "disabled" in a plan
 * if it appears in that plan's features with `false`. The minimum plan
 * is the first (by OnPremPlanOrder) where the feature is NOT disabled.
 */
export const OnPremFeatureToMinPlan: Partial<
  Record<PlanFeatureTypes, OnPremPlanTitles>
> = (() => {
  const result: Partial<Record<PlanFeatureTypes, OnPremPlanTitles>> = {};
  const sortedPlans = Object.keys(OnPremPlanOrder).sort(
    (a, b) => OnPremPlanOrder[a] - OnPremPlanOrder[b]
  ) as OnPremPlanTitles[];

  // Collect all features that are disabled in at least one plan
  const disabledFeatures = new Set<PlanFeatureTypes>();
  for (const plan of sortedPlans) {
    const def = OnPremPlanDefinitions[plan];
    for (const [feat, val] of Object.entries(def?.features ?? {})) {
      if (val === false) disabledFeatures.add(feat as PlanFeatureTypes);
    }
  }

  // For each disabled feature, find the first plan that enables it
  for (const feature of disabledFeatures) {
    for (const plan of sortedPlans) {
      const def = OnPremPlanDefinitions[plan];
      if (def?.features?.[feature] !== false) {
        result[feature] = plan;
        break;
      }
    }
  }

  return result;
})();
