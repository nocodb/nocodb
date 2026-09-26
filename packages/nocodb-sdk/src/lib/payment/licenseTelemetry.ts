export enum LicenseTelemetryEvent {
  UPGRADE_PROMPT_SHOWN = 'upgrade_prompt_shown',
  UPGRADE_CTA_CLICKED = 'upgrade_cta_clicked',
  ADMIN_NOTIFIED = 'admin_notified',
  LIMIT_HIT = 'limit_hit',
  FEATURE_BLOCKED = 'feature_blocked',
  LICENSE_STATE_CHANGED = 'license_state_changed',
}

/** Events the browser may report; the rest are emitted server-side only. */
export const LICENSE_TELEMETRY_CLIENT_EVENTS: LicenseTelemetryEvent[] = [
  LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN,
  LicenseTelemetryEvent.UPGRADE_CTA_CLICKED,
];

export const LICENSE_TELEMETRY_MAX_BATCH = 200;

const ALLOWED_PROPS: Record<LicenseTelemetryEvent, readonly string[]> = {
  [LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN]: ['feature', 'limit', 'source', 'viewer_role'],
  [LicenseTelemetryEvent.UPGRADE_CTA_CLICKED]: ['cta', 'feature', 'limit', 'source', 'viewer_role'],
  [LicenseTelemetryEvent.ADMIN_NOTIFIED]: ['feature', 'limit'],
  [LicenseTelemetryEvent.LIMIT_HIT]: ['limit', 'limit_value', 'current'],
  [LicenseTelemetryEvent.FEATURE_BLOCKED]: ['feature'],
  [LicenseTelemetryEvent.LICENSE_STATE_CHANGED]: ['from', 'to'],
};

// Enum keys and slugs only — rejects emails, URLs and free text.
const SAFE_STRING = /^[A-Za-z0-9_:.\-]{1,64}$/;
const USER_HASH = /^[a-f0-9]{32}$/;

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
    if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string' && SAFE_STRING.test(value)) out[key] = value;
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
