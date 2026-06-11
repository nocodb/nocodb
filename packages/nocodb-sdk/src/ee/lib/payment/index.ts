import {
  OnPremPlanTitles,
  PlanAddonTypes,
  PlanFeatureTypes,
  PlanLimitTypes,
  PlanOrder,
  PlanTitles,
} from 'src/lib/payment';

export * from 'src/lib/payment';

// ---------------------------------------------------------------------------
// Common limits — structural constraints applied as base layers
// ---------------------------------------------------------------------------
// CommonLimits:     Floor for ALL plans (structural constraints like max columns, views).
// CommonPaidLimits: Upgrades for paid plans (overrides CommonLimits where paid tiers differ).
//
// Layering order in resolvePlanMeta:
//   1. Base (all limits -1/unlimited, all features true)
//   2. CommonLimits (structural floor for every plan)
//   3. CommonPaidLimits (paid-tier upgrades, skipped for Free)
//   4. CloudPlanDefinitions (plan-specific overrides)
//
// To add a new structural limit:  add to CommonLimits (all plans) or CommonPaidLimits (paid only).
// To override for a specific plan: add to that plan's limits in CloudPlanDefinitions.
// ---------------------------------------------------------------------------

export const CommonLimits: Partial<Record<PlanLimitTypes, number>> = {
  [PlanLimitTypes.LIMIT_FREE_WORKSPACE]: 8,
  [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 200,
  [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: 500,
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: 25,
  [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: 200,
  [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: 50,
  [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: 10,
  [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: 500,
  [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 10,
  [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 256,
};

export const CommonPaidLimits: Partial<Record<PlanLimitTypes, number>> = {
  [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 500,
  [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
  [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: 1000,
  [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: -1,
};

// ---------------------------------------------------------------------------
// Cloud plan definitions — single source of truth for cloud plan gating
// ---------------------------------------------------------------------------
// Override model: base = all features enabled (true), all limits unlimited (-1).
// CommonLimits and CommonPaidLimits are applied first (see resolvePlanMeta).
// Each plan only lists plan-SPECIFIC overrides — disabled features and restricted limits
// beyond what the common layers already provide.
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
  // FREE — all limits explicit; only features NOT listed here are enabled
  // -------------------------------------------------------------------------
  [PlanTitles.FREE]: {
    features: {
      // Free-tier features that are gated (disabled on Free, enabled on all paid plans)
      [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: false,
      [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: false,
      [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: false,
      // Plus+ features (disabled at Free)
      [PlanFeatureTypes.FEATURE_AI]: false,
      [PlanFeatureTypes.FEATURE_AT_MENTION]: false,
      [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: false,
      [PlanFeatureTypes.FEATURE_CUSTOM_URL]: false,
      [PlanFeatureTypes.FEATURE_FILE_MODE]: false,
      [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: false,
      [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: false,
      [PlanFeatureTypes.FEATURE_FORM_CUSTOM_SUBMIT_LABEL]: false,
      [PlanFeatureTypes.FEATURE_FORM_SCHEDULING]: false,
      [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: false,
      [PlanFeatureTypes.FEATURE_FORM_GRID_LAYOUT]: false,
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
      [PlanFeatureTypes.FEATURE_TOGGLE_GROUPBY]: false,
      [PlanFeatureTypes.FEATURE_PINNED_FILTER]: false,
      [PlanFeatureTypes.FEATURE_RECORD_TEMPLATES]: false,
      [PlanFeatureTypes.FEATURE_DOCS_INLINE_COMMENTS]: false,
      [PlanFeatureTypes.FEATURE_DOCS_EXPORT_PDF]: false,
      [PlanFeatureTypes.FEATURE_BOOKMARKS]: false,
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
      [PlanFeatureTypes.FEATURE_TABLE_SYNC]: false,
      [PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO]: false,
      [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
      [PlanFeatureTypes.FEATURE_UNIQUE]: false,
      [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
      [PlanFeatureTypes.FEATURE_LIST_VIEW]: false,
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_GANTT_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_FORCE_2FA]: false,
      [PlanFeatureTypes.FEATURE_API_WEBHOOK_V3]: false,
      [PlanFeatureTypes.FEATURE_API_COMMENT_V3]: false,
      [PlanFeatureTypes.FEATURE_API_WORKFLOW_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_BASE_VARIABLES]: false,
      // Enterprise-only features (disabled at Free)
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_API_VIEW_V3]: false,
      [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: false,
      [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: false,
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
      // On-prem-only features (always disabled on cloud)
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
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
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE]: 3,
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 3,
      // Automation & workflow share one run budget + one retention limit
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 1,
      // Audit — record-level history; workspace audit log is gated off (0)
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 3,
      [PlanLimitTypes.LIMIT_WORKSPACE_AUDIT_RETENTION]: 0,
      // Trash
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 15,
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
  // PLUS — Business+ and Enterprise-only features disabled
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
      // Sync (app sync + manual table sync) is available from the first paid
      // plan; the automatic/real-time table-sync trigger is Business+ and custom
      // sync is Enterprise-only.
      [PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO]: false,
      [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
      [PlanFeatureTypes.FEATURE_UNIQUE]: false,
      [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
      [PlanFeatureTypes.FEATURE_LIST_VIEW]: false,
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_GANTT_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_FORCE_2FA]: false,
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
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
      // On-prem-only features (always disabled on cloud)
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_CALL]: 100000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 30,
      [PlanLimitTypes.LIMIT_WORKSPACE_AUDIT_RETENTION]: 0,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 60,
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 30,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 30,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 30000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 50000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 0,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 2,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 20000,
    },
  },

  // -------------------------------------------------------------------------
  // BUSINESS — Enterprise-only features disabled
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
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
      [PlanFeatureTypes.FEATURE_FORCE_2FA]: false,
      // Custom sync is Enterprise-only
      [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
      // On-prem-only features (always disabled on cloud)
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 90,
      [PlanLimitTypes.LIMIT_WORKSPACE_AUDIT_RETENTION]: 0,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 90,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 60,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 120000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 300000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 100000,
      [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 5,
    },
  },

  // -------------------------------------------------------------------------
  // SCALE — unlocks RLS, workspace audit, and trash settings over Business.
  // The pricing matrix reserves SCIM, force-2FA, team hierarchy, and the
  // advanced V3 APIs (view / dashboard / script) for Enterprise, so those stay
  // disabled here. Scale ↔ Enterprise otherwise differ by limits below.
  // -------------------------------------------------------------------------
  [PlanTitles.SCALE]: {
    features: {
      // Enterprise-only — reserved above Scale to match the pricing matrix.
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_FORCE_2FA]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_API_VIEW_V3]: false,
      [PlanFeatureTypes.FEATURE_API_DASHBOARD_V3]: false,
      [PlanFeatureTypes.FEATURE_API_SCRIPT_MANAGEMENT]: false,
      // On-prem-only features (always disabled on cloud)
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 8,
      [PlanLimitTypes.LIMIT_API_CALL]: 5000000, // 5M API calls / month
      // Record + workspace audit retention per the pricing matrix.
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_WORKSPACE_AUDIT_RETENTION]: 30,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 270,
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 180,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 90,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 240000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 150000, // 150 GB
      [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 10,
    },
  },

  // -------------------------------------------------------------------------
  // ENTERPRISE — no features disabled; all unlimited or set high
  // -------------------------------------------------------------------------
  [PlanTitles.ENTERPRISE]: {
    features: {
      // SCIM is unbundled — only the SCIM add-on grants it (see AddonDefinitions).
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      // On-prem-only features (always disabled on cloud)
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_WORKSPACE_AUDIT_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 365,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 600000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 25,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 500000,
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
// Layered override model:
//   1. Base         — all limits -1 (unlimited), all features true
//   2. CommonLimits — structural floor applied to every plan
//   3. CommonPaidLimits — upgraded structural limits for paid plans (skipped for Free)
//   4. CloudPlanDefinitions — plan-specific feature/limit overrides
// ---------------------------------------------------------------------------

export function resolvePlanMeta(
  title: PlanTitles | string
): Record<string, number | boolean> {
  const meta: Record<string, number | boolean> = {};

  // 1. Base: all limits unlimited, all features enabled
  for (const limit of Object.values(PlanLimitTypes)) {
    meta[limit] = -1;
  }
  for (const feature of Object.values(PlanFeatureTypes)) {
    meta[feature] = true;
  }

  // 2. Structural floor (all plans)
  Object.assign(meta, CommonLimits);

  // 3. Paid-tier upgrades (skip for Free)
  if (title !== PlanTitles.FREE) {
    Object.assign(meta, CommonPaidLimits);
  }

  // 4. Plan-specific overrides (disabled features + restricted limits)
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
  BUSINESS_MONTHLY = 'on_prem_business_monthly',
  BUSINESS_YEARLY = 'on_prem_business_yearly',
  SCALE_MONTHLY = 'on_prem_scale_monthly',
  SCALE_YEARLY = 'on_prem_scale_yearly',
}

// ---------------------------------------------------------------------------
// On-prem plan metadata, ordering, and upgrade paths
// ---------------------------------------------------------------------------

export const OnPremPlanMeta = {
  // Business = pink (first paid tier), Scale = indigo (mid tier), Enterprise = teal (top tier)
  [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: {
    title: OnPremPlanTitles.SELF_HOSTED_BUSINESS,
    color: 'var(--business-plan-color, #FAF5FF)',
    accent: 'var(--business-plan-accent, #FEB0E8)',
    primary: 'var(--business-plan-primary, #972377)',
    bgLight: 'var(--business-plan-bg-light, #FFEEFB)',
    bgDark: 'var(--business-plan-bg-dark, #FED8F4)',
    border: 'var(--business-plan-border, #FEB0E8)',
    badgeBgColor: 'var(--business-plan-badge-bg-color, #FFF0FB)',
    badgeTextColor: 'var(--business-plan-badge-text-color, #C44DA0)',
    staticBadgeBgColor: '#FFF0FB',
    staticBadgeTextColor: '#C44DA0',
  },
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
    title: OnPremPlanTitles.SELF_HOSTED_SCALE,
    color: 'var(--scale-plan-color, #EEEFFD)',
    accent: 'var(--scale-plan-accent, #D4D5F9)',
    primary: 'var(--scale-plan-primary, #5B5DEF)',
    bgLight: 'var(--scale-plan-bg-light, #EEEFFD)',
    bgDark: 'var(--scale-plan-bg-dark, #DCDEFA)',
    border: 'var(--scale-plan-border, #D4D5F9)',
    badgeBgColor: 'var(--scale-plan-badge-bg-color, #EEEFFD)',
    badgeTextColor: 'var(--scale-plan-badge-text-color, #5B5DEF)',
    staticBadgeBgColor: '#EEEFFD',
    staticBadgeTextColor: '#5B5DEF',
  },
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: {
    title: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
    color: 'var(--enterprise-plan-color, #EAF7F7)',
    accent: 'var(--enterprise-plan-accent, #8FC8C8)',
    primary: 'var(--enterprise-plan-primary, #0D5A5A)',
    bgLight: 'var(--enterprise-plan-bg-light, #EAF7F7)',
    bgDark: 'var(--enterprise-plan-bg-dark, #CFEAEA)',
    border: 'var(--enterprise-plan-border, #8FC8C8)',
    badgeBgColor: 'var(--enterprise-plan-badge-bg-color, #CFEAEA)',
    badgeTextColor: 'var(--enterprise-plan-badge-text-color, #0D5A5A)',
    staticBadgeBgColor: '#CFEAEA',
    staticBadgeTextColor: '#0D5A5A',
  },
} as const;

export const OnPremPlanOrder: Record<string, number> = {
  [OnPremPlanTitles.FREE]: -1,
  [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: 0,
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: 1,
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: 2,
};

export const OnPremHigherPlan = {
  [OnPremPlanTitles.FREE]: OnPremPlanTitles.SELF_HOSTED_BUSINESS,
  [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: OnPremPlanTitles.SELF_HOSTED_SCALE,
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
  // -------------------------------------------------------------------------
  // FREE — unlicensed on-prem; default-deny, explicitly enable features
  // -------------------------------------------------------------------------
  // Unlike paid plans (which start with all features enabled and list
  // overrides as `false`), the FREE plan starts with all features DISABLED.
  // Only features explicitly listed here as `true` are available.
  // See `resolveOnPremPlanMeta` and `buildOnPremPlan` for the flip logic.
  // -------------------------------------------------------------------------
  [OnPremPlanTitles.FREE]: {
    features: {
      // Explicitly enabled features for unlicensed on-prem
      [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: true,
      [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: true,
      [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: true,
      [PlanFeatureTypes.FEATURE_MAP_VIEW]: true,
      // Core Docs available on unlicensed on-prem (sub-features stay paid)
      [PlanFeatureTypes.FEATURE_DOCS]: true,
    },
    limits: {
      // Explicitly allowed limits for unlicensed on-prem.
      // Base is 0 for Free (see resolveOnPremPlanMeta) — only limits
      // listed here are non-zero. Use -1 for unlimited.
      [PlanLimitTypes.LIMIT_WORKSPACE]: 1,
      // Structural — self-hosted, no artificial caps
      [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: -1,
      [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: -1,
      [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: -1,
      [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: -1,
      [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: -1,
      [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: -1,
      [PlanLimitTypes.LIMIT_ATTACHMENTS_IN_CELL]: -1,
      [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: -1,
      [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: -1,
      // Data — self-hosted, user owns their infra
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: -1,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: -1,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: -1,
      // Seats — self-hosted, no billing
      [PlanLimitTypes.LIMIT_EDITOR]: -1,
      [PlanLimitTypes.LIMIT_COMMENTER]: -1,
      // API — self-hosted
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: -1,
      [PlanLimitTypes.LIMIT_API_CALL]: -1,
      // Record audit — retain some history even on free
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 30, // days
      // Docs — core feature available on unlicensed on-prem (matches paid cloud)
      [PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE]: -1,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
      // Doc revision history kept for 3 days on unlicensed on-prem
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 3,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 0, // days
      // Everything else (AI, automations, workflows, extensions,
      // snapshots, scripts, dashboards, sandbox, teams, RLS)
      // inherits 0 from base — disabled by default
    },
  },

  [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: {
    features: {
      // Enterprise-only
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_FORCE_2FA]: false,
      [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: false,
      [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: false,
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      [PlanFeatureTypes.FEATURE_TEAM_HIERARCHY]: false,
      [PlanFeatureTypes.FEATURE_AI_CHAT]: false,
      [PlanFeatureTypes.FEATURE_TABLE_VISIBILITY]: false,
      [PlanFeatureTypes.FEATURE_FIELD_VISIBILITY]: false,
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
      // Table sync (manual) is available on the first paid plan; automatic
      // real-time sync is gated to Scale+.
      [PlanFeatureTypes.FEATURE_TABLE_SYNC_AUTO]: false,
      // Custom sync is Enterprise-only
      [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_AI_INTEGRATIONS]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
      [PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION]: 0,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 21, // days
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 21, // days
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 90, // days
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
    },
  },
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
    features: {
      // Enterprise-only
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_CUSTOM_SYNC]: false,
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      // Not yet available on any on-prem plan
      [PlanFeatureTypes.FEATURE_AI_CHAT]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 180, // days
    },
  },
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: {
    features: {
      // SCIM is unbundled — only the SCIM add-on grants it (see AddonDefinitions).
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      // White-label is unbundled — only the white-label add-on grants it (see AddonDefinitions).
      [PlanFeatureTypes.FEATURE_WHITE_LABEL]: false,
      // Not yet available on any on-prem plan
      [PlanFeatureTypes.FEATURE_AI_CHAT]: false,
    },
    limits: {
      [PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS]: 365, // days
    },
  },
};

/**
 * On-prem: feature → lowest *paid* plan that enables it.
 * Derived from OnPremPlanDefinitions — a feature is "disabled" in a plan
 * if it appears in that plan's features with `false`. The minimum plan
 * is the first paid plan (by OnPremPlanOrder, excluding FREE) where the
 * feature is NOT disabled.
 */
export const OnPremFeatureToMinPlan: Partial<
  Record<PlanFeatureTypes, OnPremPlanTitles>
> = (() => {
  const result: Partial<Record<PlanFeatureTypes, OnPremPlanTitles>> = {};
  // Only consider paid plans (exclude FREE — it's the unlicensed state)
  const paidPlans = (Object.keys(OnPremPlanOrder) as OnPremPlanTitles[])
    .filter((p) => p !== OnPremPlanTitles.FREE)
    .sort((a, b) => OnPremPlanOrder[a] - OnPremPlanOrder[b]);

  // Collect all features that are disabled in at least one paid plan
  const disabledFeatures = new Set<PlanFeatureTypes>();
  for (const plan of paidPlans) {
    const def = OnPremPlanDefinitions[plan];
    for (const [feat, val] of Object.entries(def?.features ?? {})) {
      if (val === false) disabledFeatures.add(feat as PlanFeatureTypes);
    }
  }

  // For each disabled feature, find the first paid plan that enables it
  for (const feature of disabledFeatures) {
    for (const plan of paidPlans) {
      const def = OnPremPlanDefinitions[plan];
      if (def?.features?.[feature] !== false) {
        result[feature] = plan;
        break;
      }
    }
  }

  return result;
})();

/**
 * On-prem: limit → lowest *paid* plan that is more permissive than the Free plan.
 * "More permissive" = unlimited (-1) or strictly greater than Free's value.
 * Used by the upgrade badge to show the right plan tier when a limit blocks the user.
 */
export const OnPremLimitToMinPlan: Partial<
  Record<PlanLimitTypes, OnPremPlanTitles>
> = (() => {
  const result: Partial<Record<PlanLimitTypes, OnPremPlanTitles>> = {};
  const paidPlans = (Object.keys(OnPremPlanOrder) as OnPremPlanTitles[])
    .filter((p) => p !== OnPremPlanTitles.FREE)
    .sort((a, b) => OnPremPlanOrder[a] - OnPremPlanOrder[b]);

  const freeDef = OnPremPlanDefinitions[OnPremPlanTitles.FREE];

  // Free is default-deny (base 0); paid plans are default-allow (base -1).
  const getFreeLimit = (limit: PlanLimitTypes): number => {
    const v = freeDef?.limits?.[limit];
    return v !== undefined ? v : 0;
  };
  const getPaidLimit = (
    plan: OnPremPlanTitles,
    limit: PlanLimitTypes
  ): number => {
    const v = OnPremPlanDefinitions[plan]?.limits?.[limit];
    return v !== undefined ? v : -1;
  };

  for (const limit of Object.values(PlanLimitTypes)) {
    const freeVal = getFreeLimit(limit);
    for (const plan of paidPlans) {
      const planVal = getPaidLimit(plan, limit);
      const isMorePermissive =
        planVal === -1 || (freeVal !== -1 && planVal > freeVal);
      if (isMorePermissive) {
        result[limit] = plan;
        break;
      }
    }
  }

  return result;
})();

// ---------------------------------------------------------------------------
// resolveOnPremPlanMeta — computes the full feature/limit meta for an on-prem plan
// ---------------------------------------------------------------------------
// Layered override model:
//   Paid plans: base = all features true  → overrides disable specific features
//   FREE plan:  base = all features false → overrides enable specific features
//
// This ensures unlicensed on-prem is default-deny: new features are
// automatically unavailable on free until explicitly opted in.
// ---------------------------------------------------------------------------

export function resolveOnPremPlanMeta(
  title: OnPremPlanTitles | string
): Record<string, number | boolean> {
  const meta: Record<string, number | boolean> = {};
  const isFree = title === OnPremPlanTitles.FREE;

  // 1. Base: paid = all unlimited/enabled, free = all zero/disabled
  for (const limit of Object.values(PlanLimitTypes)) {
    meta[limit] = isFree ? 0 : -1;
  }
  for (const feature of Object.values(PlanFeatureTypes)) {
    meta[feature] = !isFree;
  }

  // 2. Plan-specific overrides
  const def = OnPremPlanDefinitions[title];
  if (def) {
    Object.assign(meta, def.features);
    Object.assign(meta, def.limits);
  }

  return meta;
}

// ---------------------------------------------------------------------------
// getHighestPlan — top tier for a deployment mode, with resolved meta
// ---------------------------------------------------------------------------
// Cloud and on-prem have separate plan ladders, so pass `isOnPrem` to pick the
// right one. Returns the highest tier (max plan order) plus its fully resolved
// feature/limit meta — use it for "the most any plan offers" checks, e.g. the
// longest doc revision retention beyond which history is permanently cut off.
export function getHighestPlan(isOnPrem = false): {
  title: PlanTitles | OnPremPlanTitles;
  meta: Record<string, number | boolean>;
} {
  if (isOnPrem) {
    const title = (Object.keys(OnPremPlanOrder) as OnPremPlanTitles[]).reduce(
      (top, t) => (OnPremPlanOrder[t] > OnPremPlanOrder[top] ? t : top)
    );
    return { title, meta: resolveOnPremPlanMeta(title) };
  }

  const title = (Object.keys(PlanOrder) as PlanTitles[]).reduce((top, t) =>
    PlanOrder[t] > PlanOrder[top] ? t : top
  );
  return { title, meta: resolvePlanMeta(title) };
}

// ---------------------------------------------------------------------------
// LICENSE_REQUIRED_OPS → PlanFeatureTypes mapping for on-prem
// ---------------------------------------------------------------------------
// Maps internal controller operation names to PlanFeatureTypes.
// Operations NOT in this map default to "any paid plan" (license-only check).
// ---------------------------------------------------------------------------

export const InternalOpToOnPremPlanFeature: Record<
  string,
  PlanFeatureTypes | undefined
> = {
  // Permissions
  setPermission: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
  dropPermission: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
  bulkDropPermissions: PlanFeatureTypes.FEATURE_TABLE_AND_FIELD_PERMISSIONS,
  // RLS
  rlsPolicyList: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyGet: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyCreate: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyUpdate: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyDelete: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicySetSubjects: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyFilterList: PlanFeatureTypes.FEATURE_RLS,
  rlsPolicyFilterCreate: PlanFeatureTypes.FEATURE_RLS,
  // Teams
  teamList: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamGet: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamCreate: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamUpdate: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamDelete: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamMembersAdd: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamMembersRemove: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  teamMembersUpdate: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  // Workspace Teams
  workspaceTeamList: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  workspaceTeamGet: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  workspaceTeamAdd: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  workspaceTeamUpdate: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  workspaceTeamRemove: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  // Base Teams
  baseTeamList: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  baseTeamGet: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  baseTeamAdd: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  baseTeamUpdate: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  baseTeamRemove: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  // Audit
  workspaceAuditList: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
  baseAuditList: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
};

// ---------------------------------------------------------------------------
// Add-on definitions — sellable SKUs distinct from the capability they grant
// ---------------------------------------------------------------------------
// An add-on (PlanAddonTypes) is a separately-purchasable SKU that unlocks one
// or more PlanFeatureTypes when active. The capability stays disabled in the
// plan definitions above; only the add-on grants it. `minPlan` enforces the
// lowest tier a workspace/instance may hold the add-on on, per ladder.
// ---------------------------------------------------------------------------

export const AddonDefinitions: Record<
  PlanAddonTypes,
  {
    /** Features unlocked when this add-on is active. */
    grants: Partial<Record<PlanFeatureTypes, boolean>>;
    /** Lowest plan that may hold the add-on, per ladder. null = not sold on that ladder. */
    minPlan: { cloud: PlanTitles | null; onPrem: OnPremPlanTitles | null };
    /** flat → Stripe quantity 1; per_seat → quantity = billable seats (forced-match). */
    quantityBasis: 'flat' | 'per_seat';
  }
> = {
  [PlanAddonTypes.ADDON_SCIM]: {
    grants: { [PlanFeatureTypes.FEATURE_SCIM]: true },
    minPlan: {
      cloud: PlanTitles.SCALE,
      onPrem: OnPremPlanTitles.SELF_HOSTED_SCALE,
    },
    quantityBasis: 'per_seat',
  },
  [PlanAddonTypes.ADDON_WHITE_LABEL]: {
    grants: { [PlanFeatureTypes.FEATURE_WHITE_LABEL]: true },
    minPlan: {
      cloud: null,
      onPrem: OnPremPlanTitles.SELF_HOSTED_ENTERPRISE,
    },
    quantityBasis: 'flat',
  },
};

/**
 * Auto-generated: feature → add-on that grants it. Used by upgrade CTAs to
 * recognize add-on-only features (no plan tier unlocks them) and advertise
 * the add-on instead of a plan upgrade that wouldn't grant the feature.
 */
export const PlanFeatureToAddon: Partial<
  Record<PlanFeatureTypes, PlanAddonTypes>
> = (() => {
  const result: Partial<Record<PlanFeatureTypes, PlanAddonTypes>> = {};
  for (const [addonKey, def] of Object.entries(AddonDefinitions)) {
    for (const feature of Object.keys(def.grants)) {
      result[feature as PlanFeatureTypes] = addonKey as PlanAddonTypes;
    }
  }
  return result;
})();

/** Merge each active add-on's granted features into a resolved plan-meta object (mutates `meta`). */
export function applyAddons(
  meta: Record<string, unknown>,
  activeKeys: PlanAddonTypes[] | undefined | null
): void {
  if (!activeKeys?.length) return;
  for (const key of activeKeys) {
    const def = AddonDefinitions[key];
    if (def) Object.assign(meta, def.grants);
  }
}
