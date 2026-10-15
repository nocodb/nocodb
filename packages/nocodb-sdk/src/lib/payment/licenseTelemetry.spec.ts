import {
  LICENSE_INSTANCE_STAT_KEYS,
  LICENSE_TELEMETRY_CLIENT_EVENTS,
  LicenseTelemetryEvent,
  licenseActivityCategory,
  licenseActivityCategoryPropKey,
  sanitizeLicenseTelemetryEvent,
  sanitizeLicenseTelemetryProps,
} from './licenseTelemetry';

describe('licenseTelemetry', () => {
  it('keeps only allowlisted props for the event', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.FEATURE_BLOCKED, {
        feature: 'feature_sso',
        source: 'x',
      })
    ).toEqual({ feature: 'feature_sso' });
  });

  it('drops strings that could carry PII', () => {
    expect(
      sanitizeLicenseTelemetryProps(
        LicenseTelemetryEvent.UPGRADE_PROMPT_SHOWN,
        {
          source: 'jane@acme.com',
          feature: 'https://acme.internal/x?y=1',
          viewer_role: 'member',
        }
      )
    ).toEqual({ viewer_role: 'member' });
  });

  it('keeps finite numbers and booleans, drops objects', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        limit: 'limit_editor',
        limit_value: 5,
        current: Infinity,
      })
    ).toEqual({ limit: 'limit_editor', limit_value: 5 });
  });

  it('rejects unknown events and bad timestamps', () => {
    expect(
      sanitizeLicenseTelemetryEvent({ event: 'page_view', ts: 1, props: {} })
    ).toBeNull();
    expect(
      sanitizeLicenseTelemetryEvent({
        event: 'feature_blocked',
        ts: 'x',
        props: {},
      })
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
      })
    ).toEqual({});
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: '123e4567-e89b-12d3-a456-426614174000',
      })
    ).toEqual({});
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: 'home-sidebar-create-workspace',
      })
    ).toEqual({ source: 'home-sidebar-create-workspace' });
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        source: 'extensions',
      })
    ).toEqual({ source: 'extensions' });
  });

  it('drops a feature that is not a real plan feature or addon', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.FEATURE_BLOCKED, {
        feature: 'not_a_feature',
      })
    ).toEqual({});
  });

  it('drops a cta outside the fixed list', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.UPGRADE_CTA_CLICKED, {
        cta: 'hack',
      })
    ).toEqual({});
  });

  it('drops a numeric prop sent as a string', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        current: '5',
      })
    ).toEqual({});
  });

  it('keeps a valid license state transition', () => {
    expect(
      sanitizeLicenseTelemetryProps(
        LicenseTelemetryEvent.LICENSE_STATE_CHANGED,
        {
          from: 'active',
          to: 'expired',
        }
      )
    ).toEqual({ from: 'active', to: 'expired' });
  });

  it('seat_added keeps delta/current/limit_value numbers and drops strings', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.SEAT_ADDED, {
        delta: 2,
        current: 3,
        limit_value: 10,
      })
    ).toEqual({ delta: 2, current: 3, limit_value: 10 });
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.SEAT_ADDED, {
        delta: '2',
        current: '3',
        limit_value: 'ten',
        email: 'a@b.c',
      })
    ).toEqual({});
  });

  it('drops negative, oversized and non-finite quantities', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        limit: 'limit_editor',
        limit_value: -1,
        current: 1e308,
      })
    ).toEqual({ limit: 'limit_editor' });
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.LIMIT_HIT, {
        limit: 'limit_editor',
        limit_value: 1.5,
        current: 0,
      })
    ).toEqual({ limit: 'limit_editor', limit_value: 1.5, current: 0 });
  });

  it('caps the folded other category at the largest exact integer', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.ACTIVITY_DAILY, {
        cat_x: Number.MAX_SAFE_INTEGER,
        cat_y: Number.MAX_SAFE_INTEGER,
      }).cat_other
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('seat events are server-only', () => {
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.SEAT_ADDED
    );
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.SEAT_REMOVED
    );
  });
  it('instance_stats keeps allowlisted counts and drops non-counts and names like a base title', () => {
    expect(
      sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.INSTANCE_STATS, {
        workspace_count: 3,
        base_count: 0,
        table_count: 1.5,
        view_count: -1,
        user_count: '12',
        webhook_count: 4,
        base_title: 'Sales CRM',
      })
    ).toEqual({ workspace_count: 3, base_count: 0, webhook_count: 4 });
    expect(LICENSE_INSTANCE_STAT_KEYS).toContain('table_count');
    expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
      LicenseTelemetryEvent.INSTANCE_STATS
    );
  });

  describe('activity daily', () => {
    it('maps event names to glossary nouns through aliases, everything else to other', () => {
      expect(licenseActivityCategory('c:table:create')).toBe('table');
      expect(licenseActivityCategory('a:column:add')).toBe('field');
      expect(licenseActivityCategory('c:project:open')).toBe('base');
      expect(licenseActivityCategory('base:invite')).toBe('base');
      expect(licenseActivityCategory('c:managed-app:open')).toBe('managed-app');
      expect(licenseActivityCategory('a:signup')).toBe('other');
      expect(licenseActivityCategory('$pageview')).toBe('other');
      expect(licenseActivityCategory('c:jane_acme_com:x')).toBe('other');
      expect(licenseActivityCategory('')).toBe('other');
    });

    it('names category props in snake case', () => {
      expect(licenseActivityCategoryPropKey('managed-app')).toBe(
        'cat_managed_app'
      );
      expect(licenseActivityCategoryPropKey('other')).toBe('cat_other');
    });

    it('keeps the date, counts and known categories, drops bad values', () => {
      expect(
        sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.ACTIVITY_DAILY, {
          date: '2026-09-28',
          total_events: 12,
          frontend_events: 7,
          backend_events: 5,
          active_users_1d: 3,
          active_users_7d: 5,
          active_users_30d: 9,
          cat_table: 4,
          cat_managed_app: 2,
          cat_other: 1,
          cat_view: -1,
          cat_base: 1.5,
          email: 'a@b.c',
        })
      ).toEqual({
        date: '2026-09-28',
        total_events: 12,
        frontend_events: 7,
        backend_events: 5,
        active_users_1d: 3,
        active_users_7d: 5,
        active_users_30d: 9,
        cat_table: 4,
        cat_managed_app: 2,
        cat_other: 1,
      });
    });

    it('drops a date that is not YYYY-MM-DD', () => {
      expect(
        sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.ACTIVITY_DAILY, {
          date: 'yesterday',
        })
      ).toEqual({});
    });

    it('counts an unknown category (newer install) as other so categories still sum', () => {
      expect(
        sanitizeLicenseTelemetryProps(LicenseTelemetryEvent.ACTIVITY_DAILY, {
          total_events: 6,
          cat_table: 1,
          cat_other: 2,
          cat_hologram: 3,
          cat_bogus: 'x',
        })
      ).toEqual({ total_events: 6, cat_table: 1, cat_other: 5 });
    });

    it('is not a client event', () => {
      expect(LICENSE_TELEMETRY_CLIENT_EVENTS).not.toContain(
        LicenseTelemetryEvent.ACTIVITY_DAILY
      );
    });
  });
});
