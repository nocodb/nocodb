import { describe, it, expect } from 'vitest';
import { SSLUsage } from 'nocodb-sdk';
import { buildSqlAuthSsl } from '../src/utils/dbSsl';

describe('buildSqlAuthSsl', () => {
  it('returns undefined for No / unset mode', () => {
    expect(buildSqlAuthSsl({})).toBeUndefined();
    expect(buildSqlAuthSsl({ sslMode: SSLUsage.No })).toBeUndefined();
  });

  it('honours the legacy boolean ssl flag when no mode is set', () => {
    expect(buildSqlAuthSsl({ ssl: true })).toBe(true);
    expect(buildSqlAuthSsl({ ssl: 'true' })).toBe(true);
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
});
