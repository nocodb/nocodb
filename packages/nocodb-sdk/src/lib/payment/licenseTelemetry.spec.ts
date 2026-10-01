import {
  LICENSE_TELEMETRY_CLIENT_EVENTS,
  LicenseTelemetryEvent,
  licenseActivityCategory,
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
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: 'extensions',
      }),
    ).toEqual({ source: 'extensions' });
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
  it('app_version_changed keeps version strings and drops free text', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.APP_VERSION_CHANGED, {
        from_version: '0.263.1',
        to_version: '0.264.0-ee.1',
      }),
    ).toEqual({ from_version: '0.263.1', to_version: '0.264.0-ee.1' });
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.APP_VERSION_CHANGED, {
        from_version: 'jane doe',
        to_version: 264,
      }),
    ).toEqual({});
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.APP_VERSION_CHANGED,
    );
  });

  describe('activity summary', () => {
    it('maps event names to a fixed category, everything else to other', () => {
      expect(licenseActivityCategory('c:table:create')).toBe('table');
      expect(licenseActivityCategory('a:links:link')).toBe('links');
      expect(licenseActivityCategory('base:invite')).toBe('base');
      expect(licenseActivityCategory('c:managed-app:open')).toBe('managed_app');
      expect(licenseActivityCategory('$pageview')).toBe('page');
      expect(licenseActivityCategory('c:jane_acme_com:x')).toBe('other');
      expect(licenseActivityCategory('')).toBe('other');
    });

    it('keeps counts and known categories, drops unknown keys and bad values', () => {
      expect(
        sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.ACTIVITY_SUMMARY, {
          total_events: 12,
          frontend_events: 7,
          backend_events: 5,
          active_users: 3,
          window_ms: 21600000,
          cat_table: 4,
          cat_other: 1,
          cat_jane: 2,
          cat_view: -1,
          cat_base: 1.5,
        }),
      ).toEqual({
        total_events: 12,
        frontend_events: 7,
        backend_events: 5,
        active_users: 3,
        window_ms: 21600000,
        cat_table: 4,
        cat_other: 1,
      });
    });

    it('is not a client event', () => {
      expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
        LicenseTelemetryEvent.ACTIVITY_SUMMARY,
      );
    });
  });
});
