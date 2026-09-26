import { SSLUsage } from '~/lib/enums';

export const validateAndExtractSSLProp = (
  connectionConfig: any,
  sslUse: SSLUsage,
  client: string
) => {
  if ('ssl' in connectionConfig && connectionConfig.ssl) {
    if (
      sslUse === SSLUsage.No ||
      (typeof connectionConfig.ssl === 'object' &&
        Object.values(connectionConfig.ssl).every(
          (v) => v === null || v === undefined
        ))
    ) {
      return undefined;
    }
    // if postgres then only allow boolean or object
    else if (
      client === 'pg' &&
      ['true', 'false'].includes(connectionConfig.ssl)
    ) {
      return connectionConfig.ssl === 'true';
    } else if (
      client === 'pg' &&
      !['boolean', 'object'].includes(typeof connectionConfig.ssl)
    ) {
      return undefined;
    }

    return connectionConfig.ssl;
  }
};

/**
 * Where a database connection config carries a credential — the one list read
 * by response masking, the vault-reference write guard and the connection
 * form's vault picker, so the three cannot disagree.
 */
export interface DbCredentialField {
  path: readonly string[];
  /** May hold a `$vault` reference instead of the value. */
  vault: boolean;
  /** Blanked before a config is returned to a client. */
  mask: boolean;
}

export const DB_CREDENTIAL_FIELDS: readonly DbCredentialField[] = [
  { path: ['connection', 'user'], vault: true, mask: false },
  { path: ['connection', 'password'], vault: true, mask: true },
  // A DSN embeds the password. Not referenceable: a reference would stand in
  // for the whole DSN, host included.
  { path: ['connection', 'connectionString'], vault: false, mask: true },
  { path: ['connection', 'connectionUri'], vault: false, mask: true },
  { path: ['connection', 'uri'], vault: false, mask: true },
  { path: ['connection', 'url'], vault: false, mask: true },
  { path: ['connection', 'ssl', 'key'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'cert'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'ca'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'pfx'], vault: false, mask: true },
  { path: ['connection', 'ssl', 'passphrase'], vault: false, mask: true },
];

const samePath = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((segment, i) => segment === b[i]);

/** Whether a config path may hold a vault reference. */
export const isVaultReferenceablePath = (path: readonly string[]): boolean =>
  DB_CREDENTIAL_FIELDS.some((field) => field.vault && samePath(field.path, path));
