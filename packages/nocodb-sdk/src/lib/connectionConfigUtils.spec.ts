import { SSLUsage } from './enums';
import {
  DB_CREDENTIAL_FIELDS,
  isVaultReferenceablePath,
  validateAndExtractSSLProp,
} from './connectionConfigUtils';

describe('DB_CREDENTIAL_FIELDS', () => {
  it.each([
    [['connection', 'user']],
    [['connection', 'password']],
    [['connection', 'ssl', 'key']],
    [['connection', 'ssl', 'cert']],
    [['connection', 'ssl', 'ca']],
  ])('allows a reference at %j', (path) => {
    expect(isVaultReferenceablePath(path)).toBe(true);
  });

  // `client` is read before resolution.
  it.each([
    [['client']],
    [['connection', 'host']],
    [['connection', 'port']],
    [['connection', 'database']],
    [['connection', 'connectionString']],
    [['connection', 'ssl']],
    [['connection', 'ssl', 'passphrase']],
    [['connection']],
    [[]],
  ])('refuses a reference at %j', (path) => {
    expect(isVaultReferenceablePath(path)).toBe(false);
  });

  it('matches whole paths only', () => {
    expect(isVaultReferenceablePath(['connection', 'password', 'x'])).toBe(
      false
    );
    expect(isVaultReferenceablePath(['password'])).toBe(false);
  });

  it('masks everything that is referenceable except the username', () => {
    for (const field of DB_CREDENTIAL_FIELDS.filter((f) => f.vault)) {
      expect(field.mask).toBe(field.path.join('.') !== 'connection.user');
    }
  });
});

describe('validateAndExtractSSLProp', () => {
  it('drops ssl when it is off', () => {
    expect(validateAndExtractSSLProp({})).toBeUndefined();
    expect(validateAndExtractSSLProp({ ssl: undefined })).toBeUndefined();
    expect(validateAndExtractSSLProp({ ssl: false })).toBeUndefined();
    // An explicit "off" beats a stale ssl blob left in form state.
    expect(
      validateAndExtractSSLProp({ ssl: { ca: 'x' } }, SSLUsage.No)
    ).toBeUndefined();
  });

  it('never emits a boolean or a string', () => {
    // mysql2 throws on both ("SSL profile must be an object") before it opens
    // a socket, which made these configs unusable on MySQL.
    for (const ssl of [true, 'true']) {
      expect(validateAndExtractSSLProp({ ssl })).toEqual({
        rejectUnauthorized: true,
      });
    }
  });

  it('keeps verifying for the shape the old form wrote', () => {
    // Preferred / Required / Required-CA / Required-Identity all produced this.
    // Node ignores the empty-string certs and verifies against the public CAs,
    // so normalising must not turn TLS off or stop verification.
    expect(
      validateAndExtractSSLProp({ ssl: { ca: '', cert: '', key: '' } })
    ).toEqual({ rejectUnauthorized: true });
    // Same for the all-null variant, which previously normalised to `undefined`
    // and silently dropped TLS on the next save.
    expect(
      validateAndExtractSSLProp({ ssl: { ca: null, cert: null, key: null } })
    ).toEqual({ rejectUnauthorized: true });
  });

  it('preserves a custom CA and client certificates', () => {
    expect(
      validateAndExtractSSLProp({ ssl: { ca: 'ca-pem', cert: 'c', key: 'k' } })
    ).toEqual({ ca: 'ca-pem', cert: 'c', key: 'k', rejectUnauthorized: true });
  });

  it('is idempotent', () => {
    for (const ssl of [
      { rejectUnauthorized: false },
      { rejectUnauthorized: true },
      { ca: 'ca-pem', rejectUnauthorized: true },
    ]) {
      const once = validateAndExtractSSLProp({ ssl });
      expect(validateAndExtractSSLProp({ ssl: once })).toEqual(once);
    }
  });
});
