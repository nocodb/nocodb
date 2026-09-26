import { PlanAddonTypes, PlanFeatureTypes, PlanLimitTypes } from './index';
import { LicenseInactiveReason } from '../globals';

export enum LicenseTelemetryEvent {
  UPGRADE_PROMPT_SHOWN = 'upgrade_prompt_shown',
  UPGRADE_CTA_CLICKED = 'upgrade_cta_clicked',
  ADMIN_NOTIFIED = 'admin_notified',
  LIMIT_HIT = 'limit_hit',
  FEATURE_BLOCKED = 'feature_blocked',
  LICENSE_STATE_CHANGED = 'license_state_changed',
  SEAT_ADDED = 'seat_added',
  SEAT_REMOVED = 'seat_removed',
  ACTIVITY_SUMMARY = 'activity_summary',
}

// Events the browser may report; the rest are emitted server-side only.
export const LICENSE_TELEMETRY_CLIENT_EVENTS: LicenseTelemetryEvent[] = [
  LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN,
  LicenseTelemetryEvent.UPGRADE_CTA_CLICKED,
];

export const LICENSE_TELEMETRY_MAX_BATCH = 200;

// Fixed list so a crafted event name can't carry free text out; everything else counts as `other`.
export const LICENSE_ACTIVITY_CATEGORIES = [
  'page',
  'interface',
  'doc',
  'document',
  'app',
  'managed_app',
  'table',
  'base',
  'workflow',
  'chat',
  'agent',
  'row',
  'field',
  'column',
  'view',
  'dashboard',
  'gantt',
  'calendar',
  'filter',
  'share',
  'script',
  'marketplace',
  'integration',
  'workspace',
  'source',
  'sync',
  'team',
  'user',
  'account',
  'links',
  'other',
] as const;

export type LicenseActivityCategory =
  (typeof LICENSE_ACTIVITY_CATEGORIES)[number];

// `c:table:create` → `table`, `base:invite` → `base`, `$pageview` → `page`.
export function licenseActivityCategory(
  eventName: string
): LicenseActivityCategory {
  if (eventName === '$pageview') return 'page';
  const parts = String(eventName ?? '').split(':');
  const segment = (/^[a-z]$/i.test(parts[0]) ? parts[1] : parts[0]) ?? '';
  const normalized = segment.toLowerCase().replace(/-/g, '_');
  return (LICENSE_ACTIVITY_CATEGORIES as readonly string[]).includes(normalized)
    ? (normalized as LicenseActivityCategory)
    : 'other';
}

type LicenseActivityCategoryPropKey = `cat_${LicenseActivityCategory}`;

const ACTIVITY_CATEGORY_PROP_KEYS = LICENSE_ACTIVITY_CATEGORIES.map(
  (c) => `cat_${c}` as LicenseActivityCategoryPropKey
);

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
  | 'active_users'
  | 'window_ms'
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
  [LicenseTelemetryEvent.ACTIVITY_SUMMARY]: [
    'total_events',
    'frontend_events',
    'backend_events',
    'active_users',
    'window_ms',
    ...ACTIVITY_CATEGORY_PROP_KEYS,
  ],
};

const USER_HASH = /^[a-f0-9]{32}$/;

// Letters-only word or lowercase kebab slug — excludes raw ids (digits, no hyphen) and UUIDs (checked below).
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

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

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

const CATEGORY_VALIDATORS = {} as Record<
  LicenseActivityCategoryPropKey,
  (value: unknown) => boolean
>;
for (const key of ACTIVITY_CATEGORY_PROP_KEYS)
  CATEGORY_VALIDATORS[key] = isCount;

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
  limit_value: isFiniteNumber,
  current: isFiniteNumber,
  delta: isFiniteNumber,
  source: isSource,
  total_events: isCount,
  frontend_events: isCount,
  backend_events: isCount,
  active_users: isCount,
  window_ms: isCount,
  ...CATEGORY_VALIDATORS,
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
