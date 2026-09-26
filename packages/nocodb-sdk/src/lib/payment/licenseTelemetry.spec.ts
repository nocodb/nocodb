import {
  LICENSE_TELEMETRY_CLIENT_EVENTS,
  LicenseTelemetryEvent,
  sanitizeLicenseTelemetryEvent,
  sanitizeLicenseTelemetryProps,
} from './licenseTelemetry';

describe('licenseTelemetry', () => {
  it('keeps only allowlisted props for the event', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.FEATURE_BLOCKED, {
        feature: 'feature_sso',
        source: 'x',
      }),
    ).toEqual({ feature: 'feature_sso' });
  });

  it('drops strings that could carry PII', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN, {
        source: 'jane@acme.com',
        feature: 'https://acme.internal/x?y=1',
        viewer_role: 'member',
      }),
    ).toEqual({ viewer_role: 'member' });
  });

  it('keeps finite numbers and booleans, drops objects', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        limit: 'limit_editor',
        limit_value: 5,
        current: Infinity,
      }),
    ).toEqual({ limit: 'limit_editor', limit_value: 5 });
  });

  it('rejects unknown events and bad timestamps', () => {
    expect(sanitizeLicenseTelemetryEvent({ event: 'page_view', ts: 1, props: {} })).toBeNull();
    expect(
      sanitizeLicenseTelemetryEvent({ event: 'feature_blocked', ts: 'x', props: {} }),
    ).toBeNull();
  });

  it('keeps a valid user_hash and drops a malformed one', () => {
    const ok = sanitizeLicenseTelemetryEvent({
      event: 'feature_blocked',
      ts: 1,
      user_hash: 'a'.repeat(32),
      props: { feature: 'feature_sso' },
    });
    expect(ok?.user_hash).toBe('a'.repeat(32));
    const bad = sanitizeLicenseTelemetryEvent({
      event: 'feature_blocked',
      ts: 1,
      user_hash: 'us_abc',
      props: {},
    });
    expect(bad?.user_hash).toBeUndefined();
  });

  it('drops a raw id and a UUID as source, keeps a real slug', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: 'w1a2b3c4d5e6f7',
      }),
    ).toEqual({});
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: '123e4567-e89b-12d3-a456-426614174000',
      }),
    ).toEqual({});
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: 'home-sidebar-create-workspace',
      }),
    ).toEqual({ source: 'home-sidebar-create-workspace' });
  });

  it('drops a feature that is not a real plan feature or addon', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.FEATURE_BLOCKED, {
        feature: 'not_a_feature',
      }),
    ).toEqual({});
  });

  it('drops a cta outside the fixed list', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        cta: 'hack',
      }),
    ).toEqual({});
  });

  it('drops a numeric prop sent as a string', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        current: '5',
      }),
    ).toEqual({});
  });

  it('keeps a valid license state transition', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LICENSE_STATE_CHANGED, {
        from: 'active',
        to: 'expired',
      }),
    ).toEqual({ from: 'active', to: 'expired' });
  });

  it('seat_added keeps delta/current/limit_value numbers and drops strings', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.SEAT_ADDED, {
        delta: 2,
        current: 3,
        limit_value: 10,
      }),
    ).toEqual({ delta: 2, current: 3, limit_value: 10 });
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.SEAT_ADDED, {
        delta: '2',
        current: '3',
        limit_value: 'ten',
        email: 'a@b.c',
      }),
    ).toEqual({});
  });

  it('seat events are server-only', () => {
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.SEAT_ADDED,
    );
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.SEAT_REMOVED,
    );
  });
});
