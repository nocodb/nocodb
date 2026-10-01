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
}

/** Events the browser may report; the rest are emitted server-side only. */
export const LICENSE_TELEMETRY_CLIENT_EVENTS: LicenseTelemetryEvent[] = [
  LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN,
  LicenseTelemetryEvent.UPGRADE_CTA_CLICKED,
];

export const LICENSE_TELEMETRY_MAX_BATCH = 200;

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
  | 'source';

const ALLOWED_PROPS: Record<
  LicenseTelemetryEvent,
  readonly LicenseTelemetryPropKey[]
> = {
  [LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN]: ['feature', 'limit', 'source', 'viewer_role'],
  [LicenseTelemetryEvent.UPGRADE_CTA_CLICKED]: ['cta', 'feature', 'limit', 'source', 'viewer_role'],
  [LicenseTelemetryEvent.ADMIN_NOTIFIED]: ['feature', 'limit'],
  [LicenseTelemetryEvent.LIMIT_HIT]: ['limit', 'limit_value', 'current'],
  [LicenseTelemetryEvent.FEATURE_BLOCKED]: ['feature'],
  [LicenseTelemetryEvent.LICENSE_STATE_CHANGED]: ['from', 'to'],
  [LicenseTelemetryEvent.SEAT_ADDED]: ['delta', 'current', 'limit_value'],
  [LicenseTelemetryEvent.SEAT_REMOVED]: ['delta', 'current', 'limit_value'],
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

const isEnumValue = (values: readonly string[]) => (v: unknown): v is string =>
  typeof v === 'string' && values.includes(v);

const isFeatureOrAddon = (v: unknown): v is string =>
  typeof v === 'string' &&
  ((Object.values(PlanFeatureTypes) as string[]).includes(v) ||
    (Object.values(PlanAddonTypes) as string[]).includes(v));

const isLimitType = (v: unknown): v is string =>
  typeof v === 'string' && (Object.values(PlanLimitTypes) as string[]).includes(v);

const isLicenseState = (v: unknown): v is string =>
  typeof v === 'string' &&
  (v === 'active' ||
    (Object.values(LicenseInactiveReason) as string[]).includes(v));

const isSource = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.length <= 64 &&
  SOURCE_SLUG.test(v) &&
  !UUID_SHAPE.test(v);

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
  props: unknown,
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
  input: unknown,
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
