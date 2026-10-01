import { PlanAddonTypes, PlanFeatureTypes, PlanLimitTypes } from './index';
import { LicenseInactiveReason } from '../globals';
import {
  LICENSE_ACTIVITY_ALIASES,
  LICENSE_ACTIVITY_FEATURES,
} from './licenseActivityVocabulary';

export { LICENSE_ACTIVITY_ALIASES, LICENSE_ACTIVITY_FEATURES };

export enum LicenseTelemetryEvent {
  UPGRADE_PROMPT_SHOWN = 'upgrade_prompt_shown',
  UPGRADE_CTA_CLICKED = 'upgrade_cta_clicked',
  ADMIN_NOTIFIED = 'admin_notified',
  LIMIT_HIT = 'limit_hit',
  FEATURE_BLOCKED = 'feature_blocked',
  LICENSE_STATE_CHANGED = 'license_state_changed',
  SEAT_ADDED = 'seat_added',
  SEAT_REMOVED = 'seat_removed',
  ACTIVITY_DAILY = 'activity_daily',
  INSTANCE_STATS = 'instance_stats',
}

// Events the browser may report; the rest are emitted server-side only.
export const LICENSE_TELEMETRY_CLIENT_EVENTS: LicenseTelemetryEvent[] = [
  LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN,
  LicenseTelemetryEvent.UPGRADE_CTA_CLICKED,
];

export const LICENSE_TELEMETRY_MAX_BATCH = 200;

// Glossary nouns only, so a crafted event name can't carry free text out; anything else is `other`.
export type LicenseActivityCategory =
  | (typeof LICENSE_ACTIVITY_FEATURES)[number]
  | 'other';

const ACTIVITY_FEATURES = new Set<string>(LICENSE_ACTIVITY_FEATURES);

// `c:table:create` → `table`, `a:column:add` → `field`, `base:invite` → `base`.
export function licenseActivityCategory(
  eventName: string
): LicenseActivityCategory {
  const parts = String(eventName ?? '').split(':');
  const segment = (/^[a-z]$/i.test(parts[0]) ? parts[1] : parts[0]) ?? '';
  const noun = LICENSE_ACTIVITY_ALIASES[segment] ?? segment;
  return ACTIVITY_FEATURES.has(noun)
    ? (noun as LicenseActivityCategory)
    : 'other';
}

// PostHog property names: `cat_managed_app` for `managed-app`.
export function licenseActivityCategoryPropKey(
  category: LicenseActivityCategory
) {
  return `cat_${category.replace(/-/g, '_')}` as const;
}

type LicenseActivityCategoryPropKey = `cat_${string}`;

const ACTIVITY_CATEGORY_PROP_KEYS: LicenseActivityCategoryPropKey[] = [
  ...LICENSE_ACTIVITY_FEATURES,
  'other' as const,
].map(licenseActivityCategoryPropKey);

const ACTIVITY_CATEGORY_OTHER = licenseActivityCategoryPropKey('other');

export const LICENSE_INSTANCE_STAT_KEYS = [
  'workspace_count',
  'base_count',
  'table_count',
  'view_count',
  'user_count',
  'external_source_count',
  'integration_count',
  'workflow_count',
  'script_count',
  'dashboard_count',
  'doc_count',
  'webhook_count',
] as const;

export type LicenseInstanceStatKey =
  (typeof LICENSE_INSTANCE_STAT_KEYS)[number];

type LicenseTelemetryPropKey =
  | 'feature'
  | 'limit'
  | 'cta'
  | 'viewer_role'
  | 'from'
  | 'to'
  | 'limit_value'
  | 'current'
  | 'delta'
  | 'source'
  | 'total_events'
  | 'frontend_events'
  | 'backend_events'
  | 'date'
  | 'active_users_1d'
  | 'active_users_7d'
  | 'active_users_30d'
  | LicenseInstanceStatKey
  | LicenseActivityCategoryPropKey;

const ALLOWED_PROPS: Record<
  LicenseTelemetryEvent,
  readonly LicenseTelemetryPropKey[]
> = {
  [LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN]: [
    'feature',
    'limit',
    'source',
    'viewer_role',
  ],
  [LicenseTelemetryEvent.UPGRADE_CTA_CLICKED]: [
    'cta',
    'feature',
    'limit',
    'source',
    'viewer_role',
  ],
  [LicenseTelemetryEvent.ADMIN_NOTIFIED]: ['feature', 'limit'],
  [LicenseTelemetryEvent.LIMIT_HIT]: ['limit', 'limit_value', 'current'],
  [LicenseTelemetryEvent.FEATURE_BLOCKED]: ['feature'],
  [LicenseTelemetryEvent.LICENSE_STATE_CHANGED]: ['from', 'to'],
  [LicenseTelemetryEvent.SEAT_ADDED]: ['delta', 'current', 'limit_value'],
  [LicenseTelemetryEvent.SEAT_REMOVED]: ['delta', 'current', 'limit_value'],
  [LicenseTelemetryEvent.ACTIVITY_DAILY]: [
    'date',
    'total_events',
    'frontend_events',
    'backend_events',
    'active_users_1d',
    'active_users_7d',
    'active_users_30d',
    ...ACTIVITY_CATEGORY_PROP_KEYS,
  ],
  [LicenseTelemetryEvent.INSTANCE_STATS]: LICENSE_INSTANCE_STAT_KEYS,
};

const USER_HASH = /^[a-f0-9]{32}$/;

// Letters-only word or lowercase kebab slug — excludes raw ids (digits, no hyphen) and UUIDs (checked below).
const UTC_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SOURCE_SLUG = /^([a-z]+|[a-z0-9]+(-[a-z0-9]+)+)$/;
const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CTA_VALUES = [
  'upgrade_license',
  'contact_sales',
  'enter_license',
  'notify_admin',
] as const;

const VIEWER_ROLE_VALUES = ['super_admin', 'member'] as const;

// Limits and usage can be fractional (storage), but never negative or beyond exact precision.
const isQuantity = (v: unknown): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= Number.MAX_SAFE_INTEGER;

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

const isEnumValue =
  (values: readonly string[]) =>
  (v: unknown): v is string =>
    typeof v === 'string' && values.includes(v);

const isFeatureOrAddon = (v: unknown): v is string =>
  typeof v === 'string' &&
  ((Object.values(PlanFeatureTypes) as string[]).includes(v) ||
    (Object.values(PlanAddonTypes) as string[]).includes(v));

const isLimitType = (v: unknown): v is string =>
  typeof v === 'string' &&
  (Object.values(PlanLimitTypes) as string[]).includes(v);

const isLicenseState = (v: unknown): v is string =>
  typeof v === 'string' &&
  (v === 'active' ||
    (Object.values(LicenseInactiveReason) as string[]).includes(v));

const isSource = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 64 &&
  SOURCE_SLUG.test(v) &&
  !UUID_SHAPE.test(v);

const isUtcDate = (v: unknown): v is string =>
  typeof v === 'string' && UTC_DATE.test(v);

const CATEGORY_VALIDATORS = {} as Record<
  LicenseActivityCategoryPropKey,
  (value: unknown) => boolean
>;
for (const key of ACTIVITY_CATEGORY_PROP_KEYS)
  CATEGORY_VALIDATORS[key] = isCount;

const INSTANCE_STAT_VALIDATORS = {} as Record<
  LicenseInstanceStatKey,
  (value: unknown) => boolean
>;
for (const key of LICENSE_INSTANCE_STAT_KEYS)
  INSTANCE_STAT_VALIDATORS[key] = isCount;

const PROP_VALIDATORS: Record<
  LicenseTelemetryPropKey,
  (value: unknown) => boolean
> = {
  feature: isFeatureOrAddon,
  limit: isLimitType,
  cta: isEnumValue(CTA_VALUES),
  viewer_role: isEnumValue(VIEWER_ROLE_VALUES),
  from: isLicenseState,
  to: isLicenseState,
  limit_value: isQuantity,
  current: isQuantity,
  delta: isQuantity,
  source: isSource,
  total_events: isCount,
  frontend_events: isCount,
  backend_events: isCount,
  date: isUtcDate,
  active_users_1d: isCount,
  active_users_7d: isCount,
  active_users_30d: isCount,
  ...CATEGORY_VALIDATORS,
  ...INSTANCE_STAT_VALIDATORS,
};

export type LicenseTelemetryProps = Record<string, string | number | boolean>;

export interface LicenseTelemetryEventPayload {
  event: LicenseTelemetryEvent;
  ts: number;
  user_hash?: string;
  props: LicenseTelemetryProps;
}

const isEvent = (v: unknown): v is LicenseTelemetryEvent =>
  typeof v === 'string' &&
  (Object.values(LicenseTelemetryEvent) as string[]).includes(v);

export function sanitizeLicenseTelemetryProps(
  event: LicenseTelemetryEvent,
  props: unknown
): LicenseTelemetryProps {
  const out: LicenseTelemetryProps = {};
  if (!props || typeof props !== 'object') return out;

  for (const key of ALLOWED_PROPS[event]) {
    const value = (props as Record<string, unknown>)[key];
    const isValid = PROP_VALIDATORS[key];
    if (isValid?.(value)) out[key] = value as string | number;
  }

  // A newer install may count a noun this side doesn't know; keep it in `other` so categories still sum to the total.
  if (event === LicenseTelemetryEvent.ACTIVITY_DAILY) {
    for (const [key, value] of Object.entries(props)) {
      if (!key.startsWith('cat_') || key in out || !isCount(value)) continue;
      out[ACTIVITY_CATEGORY_OTHER] = Math.min(
        ((out[ACTIVITY_CATEGORY_OTHER] as number) ?? 0) + value,
        Number.MAX_SAFE_INTEGER
      );
    }
  }
  return out;
}

export function sanitizeLicenseTelemetryEvent(
  input: unknown
): LicenseTelemetryEventPayload | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (!isEvent(raw.event)) return null;
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) return null;

  return {
    event: raw.event,
    ts: raw.ts,
    ...(typeof raw.user_hash === 'string' && USER_HASH.test(raw.user_hash)
      ? { user_hash: raw.user_hash }
      : {}),
    props: sanitizeLicenseTelemetryProps(raw.event, raw.props),
  };
}
