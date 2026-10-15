import { describe, it, expect } from 'vitest';
import { SSLUsage } from 'nocodb-sdk';
import { buildSqlAuthSsl, sslModeFromConfig } from '../src/utils/dbSsl';

describe('buildSqlAuthSsl', () => {
  it('returns undefined for No / unset mode', () => {
    expect(buildSqlAuthSsl({})).toBeUndefined();
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.No })).toBeUndefined();
  });

  it('honours the legacy boolean ssl flag when no mode is set', () => {
    expect(buildSqlAuthSsl({ ssl: true })).toEqual({
      rejectUnauthorized: true,
    });
    expect(buildSqlAuthSsl({ ssl: 'true' })).toEqual({
      rejectUnauthorized: true,
    });
    expect(buildSqlAuthSsl({ ssl: false })).toBeUndefined();
  });

  it('encrypts without verifying for Preferred / Allowed (self-signed certs)', () => {
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.Preferred })).toEqual({
      rejectUnauthorized: false,
    });
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.Allowed })).toEqual({
      rejectUnauthorized: false,
    });
  });

  // Object form, not boolean `true` — mysql2 throws on a boolean before it
  // opens a socket, so `Required` was unusable on MySQL.
  it('verifies against public CAs for Required (no custom CA)', () => {
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.Required })).toEqual({
      rejectUnauthorized: true,
    });
  });

  it('never returns a boolean for a TLS-enabled mode (mysql2 rejects booleans)', () => {
    for (const sslMode of [
      SSLUsage.Preferred,
      SSLUsage.Allowed,
      SSLUsage.Required,
      SSLUsage.RequiredWithCa,
    ]) {
      expect(typeof buildSqlAuthSsl({ sslMode })).not.toBe('boolean');
    }
  });

  it('verifies against the supplied CA whenever one is pasted', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----';
    expect(
      buildSqlAuthSsl({ sslMode: SSLUsage.RequiredWithCa, sslCa: ca }),
    ).toEqual({ ca, rejectUnauthorized: true });
    // A pasted CA implies verification even if the mode isn't Required-CA.
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.Preferred, sslCa: ca })).toEqual(
      {
        ca,
        rejectUnauthorized: true,
      },
    );
  });

  it('ignores a blank / whitespace-only CA', () => {
    expect(
      buildSqlAuthSsl({ sslMode: SSLUsage.Preferred, sslCa: '   ' }),
    ).toEqual({ rejectUnauthorized: false });
  });

  it('carries client certificates without changing server verification', () => {
    expect(
      buildSqlAuthSsl({
        sslMode: SSLUsage.Preferred,
        sslCert: 'c',
        sslKey: 'k',
      }),
    ).toEqual({ cert: 'c', key: 'k', rejectUnauthorized: false });
    expect(
      buildSqlAuthSsl({
        sslMode: SSLUsage.Required,
        sslCert: 'c',
        sslKey: 'k',
      }),
    ).toEqual({ cert: 'c', key: 'k', rejectUnauthorized: true });
  });
});

describe('sslModeFromConfig', () => {
  const ca = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----';

  it('round-trips every mode buildSqlAuthSsl can produce', () => {
    const cases: [SSLUsage, SSLUsage][] = [
      [SSLUsage.No, SSLUsage.No],
      // Allowed and Preferred are the same connection: pg has no
      // fallback-to-plaintext, so both resolve to "encrypt, don't verify".
      [SSLUsage.Allowed, SSLUsage.Preferred],
      [SSLUsage.Preferred, SSLUsage.Preferred],
      [SSLUsage.Required, SSLUsage.Required],
      // verify-ca and verify-full differ only by checkServerIdentity, which a
      // stored JSON config cannot hold.
      [SSLUsage.RequiredWithIdentity, SSLUsage.Required],
    ];

    for (const [mode, expected] of cases) {
      expect(sslModeFromConfig(buildSqlAuthSsl({ sslMode: mode }))).toBe(
        expected,
      );
    }

    expect(
      sslModeFromConfig(
        buildSqlAuthSsl({ sslMode: SSLUsage.RequiredWithCa, sslCa: ca }),
      ),
    ).toBe(SSLUsage.RequiredWithCa);
  });

  it('reads legacy shapes as the mode they already behave as', () => {
    // The old built-in form wrote this for Preferred / Required / Required-CA /
    // Required-Identity alike. Node ignores empty-string certs and falls back
    // to the public CA bundle, so all four verified — they must not come back
    // as the non-verifying Preferred.
    expect(sslModeFromConfig({ ca: '', cert: '', key: '' })).toBe(
      SSLUsage.Required,
    );
    // pg spread a bare `true` into tls.connect defaults, i.e. verified.
    expect(sslModeFromConfig(true)).toBe(SSLUsage.Required);
    expect(sslModeFromConfig('true')).toBe(SSLUsage.Required);
    expect(sslModeFromConfig(undefined)).toBe(SSLUsage.No);
    expect(sslModeFromConfig(false)).toBe(SSLUsage.No);
    // Written by the self-signed fallback on "Test connection".
    expect(sslModeFromConfig({ rejectUnauthorized: false })).toBe(
      SSLUsage.Preferred,
    );
  });

  it('never reads a TLS-enabled config as No', () => {
    for (const ssl of [
      true,
      'true',
      { ca: '', cert: '', key: '' },
      { rejectUnauthorized: false },
      { rejectUnauthorized: true },
      { ca },
    ]) {
      expect(sslModeFromConfig(ssl)).not.toBe(SSLUsage.No);
    }
  });

  it('reads a CA held as a vault reference or a file path', () => {
    // Neither is a PEM string, but both mean "verify against this CA".
    expect(
      sslModeFromConfig({
        ca: { $vault: { alias: 'v', secret: 's', path: [] } },
      }),
    ).toBe(SSLUsage.RequiredWithCa);
    expect(sslModeFromConfig({ caFilePath: '/etc/ssl/ca.pem' })).toBe(
      SSLUsage.RequiredWithCa,
    );
    // Verification explicitly off still wins — a CA does not override it.
    expect(
      sslModeFromConfig({
        caFilePath: '/etc/ssl/ca.pem',
        rejectUnauthorized: false,
      }),
    ).toBe(SSLUsage.Preferred);
  });
});
