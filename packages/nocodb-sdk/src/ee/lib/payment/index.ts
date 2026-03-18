import {
  OnPremPlanTitles,
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
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_MFA]: false,
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
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
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
      // Automation & workflow
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 0,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 1000,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 15,
      // Audit
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 14,
      // Trash
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 2,
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
      [PlanFeatureTypes.FEATURE_SYNC]: false,
      [PlanFeatureTypes.FEATURE_UNIQUE]: false,
      [PlanFeatureTypes.FEATURE_VIEW_SECTIONS]: false,
      [PlanFeatureTypes.FEATURE_LIST_VIEW]: false,
      [PlanFeatureTypes.FEATURE_TIMELINE_VIEW]: false,
      [PlanFeatureTypes.FEATURE_DOCUMENT_PERMISSIONS]: false,
      [PlanFeatureTypes.FEATURE_DATE_DEPENDENCY]: false,
      [PlanFeatureTypes.FEATURE_MFA]: false,
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
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_CALL]: 100000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 60,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 7,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 7,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 10000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 50000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 0,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 2,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 20000,
      [PlanLimitTypes.LIMIT_WORKFLOW_RETENTION]: 60,
      [PlanLimitTypes.LIMIT_WORKFLOW_RUN]: 75000,
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
    },
    limits: {
      [PlanLimitTypes.LIMIT_AI_TOKEN]: 10000,
      [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 30,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 90,
      [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 50000,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 300000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 5,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 100000,
      [PlanLimitTypes.LIMIT_TEAM_MANAGEMENT]: 5,
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
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_TRASH_RETENTION]: 180,
      [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 365,
      [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 10,
      [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000000,
      [PlanLimitTypes.LIMIT_SANDBOX_PER_BASE]: 1,
      [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 25,
      [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 500000,
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
    staticBadgeBgColor: '#D7F2FF',
    staticBadgeTextColor: '#207399',
  },
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: {
    title: OnPremPlanTitles.SELF_HOSTED_SCALE,
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
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: 0,
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: 1,
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: 2,
};

export const OnPremHigherPlan = {
  [OnPremPlanTitles.FREE]: OnPremPlanTitles.SELF_HOSTED_STARTER,
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
      [PlanFeatureTypes.FEATURE_DOCS_APIS]: true,
      [PlanFeatureTypes.FEATURE_MAP_VIEW]: true,
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
      // Audit — retain some history even on free
      [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 30, // days
      // Docs — enabled with sensible caps
      [PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_BASE]: 10,
      [PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB]: 5120,
      // Everything else (AI, automations, workflows, extensions,
      // snapshots, scripts, dashboards, sandbox, teams, RLS)
      // inherits 0 from base — disabled by default
    },
  },

  // -------------------------------------------------------------------------
  // STARTER — first paid tier; Scale+ and Enterprise features disabled
  // -------------------------------------------------------------------------
  [OnPremPlanTitles.SELF_HOSTED_STARTER]: {
    features: {
      // Scale+ only
      [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
      [PlanFeatureTypes.FEATURE_SSO]: false,
      [PlanFeatureTypes.FEATURE_PRIVATE_BASES]: false,
      // Enterprise only
      [PlanFeatureTypes.FEATURE_RLS]: false,
      [PlanFeatureTypes.FEATURE_SCIM]: false,
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
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
      [PlanFeatureTypes.FEATURE_TRASH_SETTINGS]: false,
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
