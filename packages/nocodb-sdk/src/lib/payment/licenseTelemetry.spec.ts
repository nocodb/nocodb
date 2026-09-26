import {
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
});
