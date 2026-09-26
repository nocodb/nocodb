import {
  DB_CREDENTIAL_FIELDS,
  isVaultReferenceablePath,
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
